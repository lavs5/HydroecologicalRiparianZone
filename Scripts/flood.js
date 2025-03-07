// Seasonal Flooding Extent Detection using Sentinel-1 Satellite Imagery From Google Earth Engine

//----- NOTES ---------------------------------------------------------------------//
// This script references similar methodology used from following sources
// Reference # 1: Hamidi, E., Peter, B., Muñoz, D. F., Hamed Moftakhari, & Hamid Moradkhani. (2022).
// Replication Data for: Fast flood extent monitoring with SAR change detection using Google Earth Engine.
// Harvard Dataverse. https://doi.org/10.7910/dvn/wotc7e                       
// Reference # 2: UN-SPIDER Knowledge Portal. (2020). Recommended Practice: Flood Mapping and 
// Damage Assessment Using Sentinel-1 SAR Data in Google Earth Engine. United Nations SPIDER.      
// https://www.un-spider.org/advisory-support/recommended-practices/recommended-practice-google-earth-engine-flood-mapping
// This script:                                                                           
// 1. Uses Sentinel-1 GRD Synthetic Aperture Radar (SAR) data to detect seasonally flooded areas.
// 2. Calculates the Ratio Index (RI), Normalized Difference Flood Index (NDFI), and 
// Difference Image Index (DII) to detect flooded areas.
// 3. Converts the flood masks to polygons and calculates the area of flooded pixels.
// 4. Visualizes the flood extent on the map and exports the flood polygons to Google Drive.                                  
//------------------------------------------------------------------------------------------//

//-- AOI, DATASET, & IMAGE SELECTION -------------------------------------------------//
// Define area of interest
var aoi = 
    /* color: #bbd3ff */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-123.74493562235533, 48.838063093667195],
          [-123.74493562235533, 48.75664731717302],
          [-123.60829316630064, 48.75664731717302],
          [-123.60829316630064, 48.838063093667195]]], null, false);


// Set start and end dates of a period with low precipitation.
var before_start = '2023-06-19';
var before_end = '2023-06-29';

// Set start and end dates of a period with high precipitation.
var after_start = '2023-11-01';
var after_end = '2023-11-08';

//Set SAR Parameters
var polarization = 'VH';
var pass_direction = 'ASCENDING';

// Load and filter Sentinel-1 GRD data by predefined parameters 
var collection= ee.ImageCollection('COPERNICUS/S1_GRD')
  .filter(ee.Filter.eq('instrumentMode','IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
  .filter(ee.Filter.eq('orbitProperties_pass',pass_direction)) 
  .filter(ee.Filter.eq('resolution_meters',10))
  .filterBounds(aoi)
  .select(polarization);

// Select images by predefined dates
var before_collection = collection.filterDate(before_start, before_end);
var after_collection = collection.filterDate(after_start, after_end);

// Print selected tiles to the console
  // Extract date from metadata
  function dates(imgcol){
    var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
    var printed = ee.String('from ')
      .cat(ee.Date(range.get('min')).format('YYYY-MM-dd'))
      .cat(' to ')
      .cat(ee.Date(range.get('max')).format('YYYY-MM-dd'));
    return printed;
  }
  // print dates of before images to console
  var before_count = before_collection.size();
  print(ee.String('Tiles selected: Before Flood ').cat('(').cat(before_count).cat(')'),
    dates(before_collection), before_collection);
  
  // print dates of after images to console
  var after_count = after_collection.size();
  print(ee.String('Tiles selected: After Flood ').cat('(').cat(after_count).cat(')'),
    dates(after_collection), after_collection);

// Mean Before and Min After ------------------------
// Mean Before: Provides a representative baseline of pre-flood conditions over a period of low precipitation.
// Min After: Represents the minimum backscatter values after the flood, highlights areas with significant flooding.
var mean_before = before_collection.mean().clip(aoi);
var min_after = after_collection.min().clip(aoi);
var max_after = after_collection.max().clip(aoi);
var mean_after = after_collection.mean().clip(aoi);

// Reduce radar speckle by smoothing  
var before_filtered = mean_before.focalMedian({radius: 15, kernelType: 'square', units: 'meters'});
var after_filtered = min_after.focalMedian({radius: 15, kernelType: 'square', units: 'meters'});

//Extract slope from NASA Global DEM dataset
var DEM = ee.Image("NASA/NASADEM_HGT/001").select('elevation');
var terrain = ee.Algorithms.Terrain(DEM);
var slope = terrain.select('slope');

// Include JRC layer on surface water seasonality to mask flood pixels from areas
// of "permanent" water (where there is water > 10 months of the year)
var swater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality');


//-- FLOOD EXTENT CALCULATION ----------------------------------------------//
//-- RI -------------------------------------------------//
// RI: Ratio Index = After / Before
var ri = min_after.abs().divide(mean_before.abs());

// Reduce the radar speckle by smoothing  
var ri_filtered = ri.focalMedian(15, 'square', 'meters');

// RI Min-Max Normalization -----------------------
// Normalize values to range of 0 to 1 based on Min and Max values
// Calculate the min and max values of the filtered RI image
var ri_min = ri_filtered.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

var ri_max = ri_filtered.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Calculate the range of the RI values i.e. RI_max - RI_min
var ri_rang = ee.Number(ri_max.get('VH')).subtract(ee.Number(ri_min.get('VH')));
// RI_norm = (RI_filtered - RI_min) / (RI_max - RI_min)
var ri_subtctMin = ri_filtered.subtract(ee.Number(ri_min.get('VH')));
var ri_norm = ri_subtctMin.divide(ri_rang);

// Histogram of the normalized RI values
var histogram = ui.Chart.image.histogram({
    image: ri_norm,
    region: aoi,
    scale: 10,
    maxPixels: 1e13
    });
print("ri_norm Histogram", histogram);

// RI Thresholding -----------------------
// Isolates potential flood areas by comparing normalized RI values to a calculated threshold
// To calculate the threshold, compute the mean and standard deviation of the normalized RI values
var ri_mean = ri_norm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

var ri_std = ri_norm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Threshold = Mean + 0.25 * Standard Deviation, where k Coeficient = 0.25
// This threshold value is adopted from Hamidi et al. 2022
var ri_th = ee.Number(ri_mean.get('VH')).add(ee.Number(0.25).multiply(ee.Number(ri_std.get('VH'))));
print('ri_th = ', ri_th);

// Apply Thresholding on RI
var ri_filtered = ri_norm.gt(ri_th);

// RI masking -----------------------
//Flooded layer where perennial water bodies (water > 10 mo/yr) is assigned a 0 value
var swater_mask = swater.gte(10).updateMask(swater.gte(10));
var ri_flooded_mask = ri_filtered.where(swater_mask,0);

// final flooded area without pixels in perennial waterbodies
var ri_flooded = ri_flooded_mask.updateMask(ri_flooded_mask);

// Compute connectivity of pixels to eliminate those connected to 5 or fewer neighbours
// This operation reduces noise of the flood extent product 
var connections = ri_flooded.connectedPixelCount();    
var ri_flooded = ri_flooded.updateMask(connections.gte(5));

// Mask out areas with more than 5 percent slope using a Digital Elevation Model 
var ri_flooded = ri_flooded.updateMask(slope.lt(5));

//------------------------------------------------------  NDFI  ---------------------------------------------------//

// NDFI: Normalized Flood Index = (Before – After) / (Before + After)
var ndfi = mean_before.abs().subtract(min_after.abs())
            .divide(mean_before.abs().add(min_after.abs()));

// Reduce the radar speckle by smoothing  
var ndfi_filtered = ndfi.focalMedian(15, 'square', 'meters');

// NDFI Min-Max Normalization -----------------------
// Normalize values to range of 0 to 1 based on Min and Max values
// Calculate the min and max values of the filtered NDFI image
var ndfi_min = ndfi_filtered.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });
var ndfi_max = ndfi_filtered.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Calculate the range of the NDFI values i.e. NDFI_max - NDFI_min
var ndfi_rang = ee.Number(ndfi_max.get('VH')).subtract(ee.Number(ndfi_min.get('VH')));
// NDFI_norm = (NDFI_filtered−NDFI_min) / (NDFI_max−NDFI_min)
var ndfi_subtctMin = ndfi_filtered.subtract(ee.Number(ndfi_min.get('VH')));
var ndfi_norm = ndfi_subtctMin.divide(ndfi_rang);

// Histogram of the normalized NDFI values
var histogram = ui.Chart.image.histogram({
    image: ndfi_norm,
    region: aoi,
    scale: 10,
    maxPixels: 1e13
    });
print("ndfi_norm Histogram", histogram);

// NDFI Thresholding -----------------------
// Isolates potential flood areas by comparing normalized RI values to a calculated threshold
// To calculate the threshold, compute the mean and standard deviation of the normalized NDFI values
var ndfi_mean = ndfi_norm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

var ndfi_std = ndfi_norm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Threshold = Mean - 1 * Standard Deviation, where k Coeficient = 1
// This threshold value is adopted from Hamidi et al. 2022
var ndfi_th = ee.Number(ndfi_mean.get('VH')).subtract(ee.Number(1.0).multiply(ee.Number(ndfi_std.get('VH'))));
print('ndfi_th = ', ndfi_th);

// Apply Thresholding Value on NDFI
var ndfi_filtered = ndfi_norm.lt(ndfi_th);

// NDFI Masking -------------------------------------
//Flooded layer where perennial water bodies (water > 10 mo/yr) is assigned a 0 value
var ndfi_flooded_mask = ndfi_filtered.where(swater_mask,0);

// final flooded area without pixels in perennial waterbodies
var ndfi_flooded = ndfi_flooded_mask.updateMask(ndfi_flooded_mask);

// Compute connectivity of pixels to eliminate those connected to 5 or fewer neighbours
// This operation reduces noise of the flood extent product 
var connections = ndfi_flooded.connectedPixelCount();    
var ndfi_flooded = ndfi_flooded.updateMask(connections.gte(5));

// Mask out areas with more than 5 percent slope using a Digital Elevation Model 
var ndfi_flooded = ndfi_flooded.updateMask(slope.lt(5));


//---------------------------------------------------  DII  -----------------------------------------------------//

// DII: Difference Image Index = After - Before
var dii = min_after.abs().subtract(mean_before.abs());

// Apply reduce the radar speckle by smoothing  
var dii_filtered = dii.focalMedian(15, 'square', 'meters');

// DII Min-Max Normalization
// Normalize values to range of 0 to 1 based on Min and Max values
// Calculate the min and max values of the filtered DII image
var dii_min = dii_filtered.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

var dii_max = dii_filtered.reduceRegion({
    reducer: ee.Reducer.max(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Calculate the range of the DII values i.e. DII_max - DII_min
var dii_rang = ee.Number(dii_max.get('VH')).subtract(ee.Number(dii_min.get('VH')));
// DII_norm = (DII_filtered−DII_min) / (DII_max−DII_min)
var dii_subtctMin = dii_filtered.subtract(ee.Number(dii_min.get('VH')));
var dii_norm = dii_subtctMin.divide(dii_rang);

var histogram = ui.Chart.image.histogram({
    image: dii_norm,
    region: aoi,
    scale: 10,
    maxPixels: 1e13
    });
print("dii_norm Histogram", histogram);

// DII Thresholding ------------------------
// Isolates potential flood areas by comparing normalized RI values to a calculated threshold
// To calculate the threshold, compute the mean and standard deviation of the normalized DII values
var dii_mean = dii_norm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

var dii_std = dii_norm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
    });

// Threshold = Mean + 0.8 * Standard Deviation, where k Coeficient = 0.8
// This threshold value is adopted from Hamidi et al. 2022
var dii_th = ee.Number(dii_mean.get('VH')).add(ee.Number(0.8).multiply(ee.Number(dii_std.get('VH'))));
print('dii_th = ', dii_th);

// Apply Thresholding on DII
var dii_filtered = dii_norm.gt(dii_th);

// DII Masking -------------------------------------
//Flooded layer where perennial water bodies (water > 10 mo/yr) is assigned a 0 value
var dii_flooded_mask = dii_filtered.where(swater_mask,0);

// final flooded area without pixels in perennial waterbodies
var dii_flooded = dii_flooded_mask.updateMask(dii_flooded_mask);

// Compute connectivity of pixels to eliminate those connected to 5 or fewer neighbours
// This operation reduces noise of the flood extent product 
var connections = dii_flooded.connectedPixelCount();    
var dii_flooded = dii_flooded.updateMask(connections.gte(5));

// Mask out areas with more than 5 percent slope using a Digital Elevation Model 
var dii_flooded = dii_flooded.updateMask(slope.lt(5));

//------------------------------ FLOOD POLYGONS ----------------------------------//
// Convert the flood masks to polygons for each index
var polygonsRI = ri_flooded.reduceToVectors({
  reducer: ee.Reducer.countEvery(),
  geometry: aoi, 
  bestEffort: false,
  maxPixels: 1e13,
  scale: 10  
});

var polygonsNDFI = ndfi_flooded.reduceToVectors({
  reducer: ee.Reducer.countEvery(),
  geometry: aoi, 
  bestEffort: false,
  maxPixels: 1e13,
  scale: 10  
});

var polygonsDII = dii_flooded.reduceToVectors({
  reducer: ee.Reducer.countEvery(),
  geometry: aoi, 
  bestEffort: false,
  maxPixels: 1e13,
  scale: 10  
});

// Create a raster layer containing the area information of each pixel 
var ri_flood_pixelarea = ri_flooded.select(polarization).multiply(ee.Image.pixelArea());
var ndfi_flood_pixelarea = ndfi_flooded.select(polarization).multiply(ee.Image.pixelArea());
var dii_flood_pixelarea = dii_flooded.select(polarization).multiply(ee.Image.pixelArea());

// Sum the areas of flooded pixels default is set to 'bestEffort: true' in order to reduce 
// compuation time, for a more accurate result set bestEffort to false and increase 'maxPixels'. 
var ri_flood_stats = ri_flood_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13,
  bestEffort: false
  });

var ndfi_flood_stats = ndfi_flood_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13,
  bestEffort: false
  });

var dii_flood_stats = dii_flood_pixelarea.reduceRegion({
  reducer: ee.Reducer.sum(),              
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13,
  bestEffort: false
  });

// Convert the flood extent to hectares  
var ri_flood_area_ha = ri_flood_stats
  .getNumber(polarization)
  .divide(10000)
  .round();

var ndfi_flood_area_ha = ndfi_flood_stats
  .getNumber(polarization)
  .divide(10000)
  .round();

var dii_flood_area_ha = dii_flood_stats
  .getNumber(polarization)
  .divide(10000)
  .round();

//Flooded Area in Ha
print("Area in Ha flooded based on RI:",ri_flood_area_ha);
print("Area in Ha flooded based on NDFI:",ndfi_flood_area_ha);
print("Area in Ha flooded based on DII:",dii_flood_area_ha);

//------------------------------  DISPLAY PRODUCTS  ----------------------------------//
// Before and after flood SAR mosaic
Map.centerObject(aoi,12);-
Map.addLayer(mean_before,{},'Before Composite');
Map.addLayer(min_after,{},' After Composite');
Map.addLayer(before_filtered, {}, 'Before Flood', 0);
Map.addLayer(after_filtered, {}, 'After Flood', 0);

Map.addLayer(ri, {}, 'Raw RI');
Map.addLayer(ri_filtered, {}, 'RI Thresholded');
Map.addLayer(ri_flooded, {}, 'RI Flooded Water Mask');

Map.addLayer(ndfi, {}, 'Raw NDFI');
Map.addLayer(ndfi_filtered, {}, 'NDFI Thresholded');
Map.addLayer(ndfi_flooded, {}, 'NDFI Flooded Water Mask');

Map.addLayer(dii, {}, 'Raw DII');
Map.addLayer(dii_filtered, {}, 'DII Thresholded');
Map.addLayer(dii_flooded, {}, 'DII Flooded Water Mask');

// Visualize the polygons (areas of dense vegetation for each index)
Map.addLayer(polygonsRI, {color: '#2c7fb8'}, 'RI Flooded Polygons');
Map.addLayer(polygonsNDFI, {color: '#41b6c4'}, 'NDFI Flooded Polygons');
Map.addLayer(polygonsDII, {color: '#253494'}, 'DII Flooded Polygons');


//----------------------------------- EXPORT ----------------------------------------------//

Export.table.toDrive({
  collection: polygonsRI,
  description: 'Flood_RI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});

Export.table.toDrive({
  collection: polygonsNDFI,
  description: 'Flood_NDFI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});

Export.table.toDrive({
  collection: polygonsDII,
  description: 'Flood_DII_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});