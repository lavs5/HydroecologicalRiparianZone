// High Moisture Extent Detection using Sentinel-2 Satellite Imagery From Google Earth Engine

//--------------------NOTES--------------------------------------------------------------------//
// This script:
// 1. Uses Sentinel-2 multispectral satellite imagery to detect high moisture extent.
// 2. Calculates three spectral indices: Soil Wetness Index (SWI), Normalized Difference
// Moisture Index (NDMI), and Modified Normalized Difference Water Index (MNDWI).
// 3. Normalizes the indices and thresholds to identify high moisture pixels.
// 4. Creates masks to exclude pixels in perennial waterbodies.
// 5. Calculates the area of high moisture pixels detected by each index.
// 6. Visualizes results on the map & exports the high moisture polygons 
// as GeoJSON files to Google Drive.
// 7. Uses examples from Google Earth Engine Help Documentation
//-----------------------------------------------------------------------------------------------//

//---------------------AREA OF INTEREST-----------------------------------------------------//

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

//--------------------SENTINEL-2 PARAMETERS-------------------------------------------------//

// Select the dates after heavy precipitation (Oct-Dec)
var startDate = '2023-11-01';
var endDate = '2023-12-31';
  
// Load the Sentinel-2 image collection
var collection = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

// Function to identify selected images 
function dates(imgcol){
  var range = imgcol.reduceColumns(ee.Reducer.minMax(), ["system:time_start"]);
  var printed = ee.String('from ')
    .cat(ee.Date(range.get('min')).format('YYYY-MM-dd'))
    .cat(' to ')
    .cat(ee.Date(range.get('max')).format('YYYY-MM-dd'));
  return printed;
}

// print dates of images to console
var img_count = collection.size();
print(ee.String('Images selected: ').cat('(').cat(img_count).cat(')'),
      dates(collection), collection);

// Include JRC layer on surface water seasonality to mask flood pixels from areas
// of "permanent" water (where there is water > 10 months of the year)
var swater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality');

//--------------------CALCULATE INDICES-----------------------------------------------------//

// Map function to calculate spectral index for each image in the collection
var withIndices = collection.map(function(image)
{
  // Select the QA60 band (cloud and shadow flags)
    var qa = image.select('QA60');
    
  // Define bit positions for cloud and shadow (bit 10 for clouds, bit 11 for shadows)
    var cloudBit = 10;
    var shadowBit = 11;
    
  // Bitwise operations to extract cloud and shadow flags
    var clouds = qa.bitwiseAnd(Math.pow(2, cloudBit)).neq(0);  // Cloud bit mask
    var shadows = qa.bitwiseAnd(Math.pow(2, shadowBit)).neq(0);  // Shadow bit mask
    
  // Bands needed for indices
    var green = image.select('B3');  // Green band
    var blue = image.select('B2');  // Blue band
    var swir1 = image.select('B11');  // SWIR1 band
  
  // Calculate SWI, NDMI, MNDWI
    var swi = image.expression('(blue > swir1) ? 1 / sqrt(blue - swir1) : 0', {'blue': blue,'swir1': swir1}).rename('SWI');
    var ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
    var mndwi = green.subtract(swir1).divide(green.add(swir1)).rename('MNDWI')
  
  // Mask clouds and shadows from each index
    var maskedSWI = swi.updateMask(clouds.not().and(shadows.not()));
    var maskedNDMI = ndmi.updateMask(clouds.not().and(shadows.not()));
    var maskedMNDWI = mndwi.updateMask(clouds.not().and(shadows.not()));
  
  // Add the masked indices as new bands to the image
    return image.addBands(maskedSWI).addBands(maskedNDMI).addBands(maskedMNDWI);
});

//-------------------- WATER EXTENT-----------------------------------------------//

// Calculate the median for each index (to avoid outliers due to clouds/shadows)
var medianSWI = withIndices.select('SWI').median().clip(aoi);
var medianNDMI = withIndices.select('NDMI').median().clip(aoi);
var medianMNDWI = withIndices.select('MNDWI').median().clip(aoi);

// Min-Max normalization--------------------------
// Normalize the indices to a range of [0, 1] for better comparison
// Calculate the min and max values of each index
var minSWI = medianSWI.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxSWI = medianSWI.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var minNDMI = medianNDMI.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxNDMI = medianNDMI.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var minMNDWI = medianMNDWI.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxMNDWI = medianMNDWI.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});
  
// Normalize to [0, 1]
// Normalized index = (index - min) / (max - min)
var swi_range= ee.Number(maxSWI.get('SWI')).subtract(ee.Number(minSWI.get('SWI')));
var swi_subtctMin = medianSWI.subtract(ee.Number(minSWI.get('SWI')));
var SWInorm = swi_subtctMin.divide(swi_range);

var ndmi_range= ee.Number(maxNDMI.get('NDMI')).subtract(ee.Number(minNDMI.get('NDMI')));
var ndmi_subtctMin = medianNDMI.subtract(ee.Number(minNDMI.get('NDMI')));
var NDMInorm = ndmi_subtctMin.divide(ndmi_range);

var mndwi_range= ee.Number(maxMNDWI.get('MNDWI')).subtract(ee.Number(minMNDWI.get('MNDWI')));
var mndwi_subtctMin = medianMNDWI.subtract(ee.Number(minMNDWI.get('MNDWI')));
var MNDWInorm = mndwi_subtctMin.divide(mndwi_range);

// Histograms -----------------------
// Display histograms of the normalized indices
var swiHistogram = ui.Chart.image.histogram({
  image: SWInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var ndmiHistogram = ui.Chart.image.histogram({
  image: NDMInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var mndwiHistogram = ui.Chart.image.histogram({
  image: MNDWInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

print('Normalized SWI Histogram',swiHistogram);
print('Normalized NDMI Histogram',ndmiHistogram);
print('Normalized MNDWI Histogram',mndwiHistogram);

// Thresholding -----------------------
// Isolates potential soil areas by comparing normalized values to a calculated threshold
// Threshold = Mean + k * Standard Deviation
// Calculate mean and standard deviation of each index
var swi_mean = SWInorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var swi_std = SWInorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var ndmi_mean = NDMInorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var ndmi_std = NDMInorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var mndwi_mean = MNDWInorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var mndwi_std = MNDWInorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

// Threshold = Mean + k * Standard Deviation
// Different values of k (e.g., 0.1, 0.25, 0.5, 0.01) were evaluated
// k = 0.1 was selected to balance between identification of high moisture vs. minimizing false positives.
var swi_th = ee.Number(swi_mean.get('SWI')).subtract(ee.Number(0.1).multiply(ee.Number(swi_std.get('SWI'))));
var ndmi_th = ee.Number(ndmi_mean.get('NDMI')).add(ee.Number(0.1).multiply(ee.Number(ndmi_std.get('NDMI'))));
var mndwi_th = ee.Number(mndwi_mean.get('MNDWI')).add(ee.Number(0.1).multiply(ee.Number(mndwi_std.get('MNDWI'))));

print('SWI Min, Max, Mean, STD, Threshold = ', minSWI.get('SWI'), maxSWI.get('SWI'), swi_mean.get('SWI'), swi_std.get('SWI'), swi_th);
print('NDMI Min, Max, Mean, STD, Threshold = ', minNDMI.get('NDMI'), maxNDMI.get('NDMI'), ndmi_mean.get('NDMI'), ndmi_std.get('NDMI'), ndmi_th);
print('MNDWI Min, Max, Mean, STD, Threshold = ', minMNDWI.get('MNDWI'), maxMNDWI.get('MNDWI'), mndwi_mean.get('MNDWI'), mndwi_std.get('MNDWI'), mndwi_th);

// Apply Threshold
var swi_filtered = SWInorm.lt(swi_th);
var ndmi_filtered = NDMInorm.gt(ndmi_th);
var mndwi_filtered = MNDWInorm.gt(mndwi_th);

// Masking -----------------------
// Include JRC layer to identify surface water seasonality i.e. areas
// of "permanent" water (where there is water > 10 months of the year)
var swater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality');
var swater_mask = swater.gte(10).updateMask(swater.gte(10));

// Mask pixels in perennial waterbodies
var swi_mask = swi_filtered.where(swater_mask,0);
var ndmi_mask = ndmi_filtered.where(swater_mask,0);
var mndwi_mask = mndwi_filtered.where(swater_mask,0);

// final layer without pixels in perennial waterbodies
var swi = swi_mask.updateMask(swi_mask);
var ndmi = ndmi_mask.updateMask(ndmi_mask);
var mndwi = mndwi_mask.updateMask(mndwi_mask);

// Compute connectivity of pixels to eliminate those connected to 10 or fewer neighbours
// This operation reduces noise 
var swiconnections = swi.connectedPixelCount();    
var swi = swi.updateMask(swiconnections.gte(10));

var ndmiconnections = ndmi.connectedPixelCount();    
var ndmi = ndmi.updateMask(ndmiconnections.gte(10));

var mndwiconnections = mndwi.connectedPixelCount();    
var mndwi = mndwi.updateMask(mndwiconnections.gte(10));


//--------------------WATER/MOISTURE POLYGONS---------------------------------------------//
  
// Convert the masks to polygons for each index
var polygonsSWI = swi.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10  
});

var polygonsNDMI = ndmi.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10  
});

var polygonsMNDWI = mndwi.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10
});
  

//--------------------WATER EXTENT AREA CALCULATION-------------------------------------//

// Create a raster layer containing the area information of each pixel 
var SWIArea = swi.multiply(ee.Image.pixelArea());
var NDMIArea = ndmi.multiply(ee.Image.pixelArea());
var MNDWIArea = mndwi.multiply(ee.Image.pixelArea());

// Sum of water/moisture pixels, set besteffort: 'false' for accurate results
var SWIStats = SWIArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var NDMIStats = NDMIArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var MNDWIStats = MNDWIArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});


// Get total area (in m²) and convert to hectares
var SWIAreaHa = SWIStats.get('SWI');
SWIAreaHa = ee.Number(SWIAreaHa).divide(10000).round();

var NDMIAreaHa = NDMIStats.get('NDMI');
NDMIAreaHa = ee.Number(NDMIAreaHa).divide(10000).round();

var MNDWIAreaHa = MNDWIStats.get('MNDWI');
MNDWIAreaHa = ee.Number(MNDWIAreaHa).divide(10000).round();


// Print the total area for each index
print('Pixels area detected using SWI (ha):', SWIAreaHa);
print('Pixels area detected using NDMI (ha):', NDMIAreaHa);
print('Pixels area detected using MNDWI (ha):', MNDWIAreaHa);

//------------------------------  DISPLAY PRODUCTS  ----------------------------------------//

// Visualize the water/moisture pixels
Map.centerObject(aoi, 12);

Map.addLayer(medianSWI, {}, 'median SWI',0);
Map.addLayer(medianNDMI, {}, 'median NDMI',0);
Map.addLayer(medianMNDWI, {}, 'median MNDWI',0);

Map.addLayer(SWInorm,{},'SWI normalized',0);
Map.addLayer(NDMInorm,{},'NDMI normalized',0);
Map.addLayer(MNDWInorm,{},'MNDWI normalized',0);

Map.addLayer(swi_filtered,{},'SWI Threshold',0);
Map.addLayer(ndmi_filtered,{},'NDMI Threshold',0);
Map.addLayer(mndwi_filtered,{},'MNDWI Threshold',0);

Map.addLayer(swi,{palette:['011f4b']},'SWI masked');
Map.addLayer(ndmi,{palette:['005b96']},'NDMI masked');
Map.addLayer(mndwi,{palette:['7adbf0']},'MNDWI masked');

// Visualize the polygons (areas of water/moisture detected by each index)
Map.addLayer(polygonsSWI, {color: '011f4b'}, 'SWI Polygons',0);
Map.addLayer(polygonsNDMI, {color: '005b96'}, 'NDMI Polygons',0);
Map.addLayer(polygonsMNDWI, {color: '7adbf0'}, 'MNDWI Polygons',0);


//----------------------------------- EXPORT -----------------------------------------------//
Export.table.toDrive({
  collection: polygonsSWI,
  description: 'water_SWI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsNDMI,
  description: 'water_NDMI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsMNDWI,
  description: 'water_MNDWI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
