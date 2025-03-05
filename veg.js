// Vegetation Extent Detection using Sentinel-2 Satellite Imagery From Google Earth Engine

//---------------------NOTES-------------------------------------------------------------------//
// This script:
// 1. Uses Sentinel-2 multispectral satellite imagery to detect dense vegetation extent.
// 2. Calculates four spectral indices: Normalized Difference Vegetation Index (NDVI), Green 
// Normalized Difference Vegetation Index (GNDVI), Enhanced Vegetation Index (EVI), 
// and Soil-Adjusted Vegetation Index (SAVI).
// 3. Normalizes the indices and thresholds to identify dense vegetation pixels.
// 4. Identifies more than 5 pixel connectivity and reduces noise.
// 5. Calculates the area of dense vegetation pixels detected by each index.
// 6. Visualizes results on the map & exports the dense vegetation polygons 
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

// Select the summer months (June 1st to August 31st)
var startDate = '2023-06-01';
var endDate = '2023-08-31';
  
// Load the Sentinel-2 image collection
var collection = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

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
    var red = image.select('B4');  // Red band
    var green = image.select('B3');  // Green band
    var nir = image.select('B8');  // Near-Infrared band
    var blue = image.select('B2');  // Blue band
  
  // Calculate NDVI, GNDVI, EVI, and SAVI
    var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    var gndvi = image.normalizedDifference(['B8', 'B3']).rename('GNDVI');
    var evi = nir.subtract(red).multiply(2.5).divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(10000)).rename('EVI');
    var savi = nir.subtract(red).divide(nir.add(red).add(0.5)).multiply(1.5).rename('SAVI');
  
  // Mask clouds and shadows from each index
    var maskedNDVI = ndvi.updateMask(clouds.not().and(shadows.not()));
    var maskedGNDVI = gndvi.updateMask(clouds.not().and(shadows.not()));
    var maskedEVI = evi.updateMask(clouds.not().and(shadows.not()));
    var maskedSAVI = savi.updateMask(clouds.not().and(shadows.not()));
  
  // Add the masked indices as new bands to the image
    return image.addBands(maskedNDVI).addBands(maskedGNDVI).addBands(maskedEVI).addBands(maskedSAVI);
});

//--------------------DENSE VEGETATION EXTENT-----------------------------------------------//

// Calculate the median for each index (to avoid outliers due to clouds/shadows)
var medianNDVI = withIndices.select('NDVI').median().clip(aoi);
var medianGNDVI = withIndices.select('GNDVI').median().clip(aoi);
var medianEVI = withIndices.select('EVI').median().clip(aoi);
var medianSAVI = withIndices.select('SAVI').median().clip(aoi);

// Min-Max normalization
// Calculate min and max values for each index
var minNDVI = medianNDVI.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var maxNDVI = medianNDVI.reduceRegion({
reducer: ee.Reducer.max(),
geometry: aoi,
scale: 10,
maxPixels: 1e13
});

var minGNDVI = medianGNDVI.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var maxGNDVI = medianGNDVI.reduceRegion({
reducer: ee.Reducer.max(),
geometry: aoi,
scale: 10,
maxPixels: 1e13
});

var minEVI = medianEVI.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var maxEVI = medianEVI.reduceRegion({
reducer: ee.Reducer.max(),
geometry: aoi,
scale: 10,
maxPixels: 1e13
});

var minSAVI = medianSAVI.reduceRegion({
  reducer: ee.Reducer.min(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var maxSAVI = medianSAVI.reduceRegion({
reducer: ee.Reducer.max(),
geometry: aoi,
scale: 10,
maxPixels: 1e13
});

// Normalize to [0, 1]
// Calculate the range and subtract the min value from the median
// Then divide by the range to normalize the values
var ndvi_range= ee.Number(maxNDVI.get('NDVI')).subtract(ee.Number(minNDVI.get('NDVI')));
var ndvi_subtctMin = medianNDVI.subtract(ee.Number(minNDVI.get('NDVI')));
var NDVInorm = ndvi_subtctMin.divide(ndvi_range);

var gndvi_range= ee.Number(maxGNDVI.get('GNDVI')).subtract(ee.Number(minGNDVI.get('GNDVI')));
var gndvi_subtctMin = medianGNDVI.subtract(ee.Number(minGNDVI.get('GNDVI')));
var GNDVInorm = gndvi_subtctMin.divide(gndvi_range);

var evi_range= ee.Number(maxEVI.get('EVI')).subtract(ee.Number(minEVI.get('EVI')));
var evi_subtctMin = medianEVI.subtract(ee.Number(minEVI.get('EVI')));
var EVInorm = evi_subtctMin.divide(evi_range);

var savi_range= ee.Number(maxSAVI.get('SAVI')).subtract(ee.Number(minSAVI.get('SAVI')));
var savi_subtctMin = medianSAVI.subtract(ee.Number(minSAVI.get('SAVI')));
var SAVInorm = savi_subtctMin.divide(savi_range);

// Histograms show the distribution of pixel values in the area of interest
var ndviHistogram = ui.Chart.image.histogram({
  image: NDVInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var gndviHistogram = ui.Chart.image.histogram({
  image: GNDVInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var eviHistogram = ui.Chart.image.histogram({
  image: EVInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var saviHistogram = ui.Chart.image.histogram({
  image: SAVInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

print('Normalized NDVI Histogram',ndviHistogram);
print('Normalized GNDVI Histogram',gndviHistogram);
print('Normalized EVI Histogram',eviHistogram);
print('Normalized SAVI Histogram',saviHistogram);

// Thresholding -----------------------
// Calculate the mean and standard deviation for each index
var ndvi_mean = NDVInorm.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var ndvi_std = NDVInorm.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var gndvi_mean = GNDVInorm.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var gndvi_std = GNDVInorm.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var evi_mean = EVInorm.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var evi_std = EVInorm.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var savi_mean = SAVInorm.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var savi_std = SAVInorm.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

// Threshold = Mean + k * Standard Deviation
// Different values of k (e.g., 0.1, 0.25, 0.5, 0.01) were evaluated
// k = 0.25 was selected to balance between identification of dense vegetation vs. minimizing false positives.
var ndvi_th = ee.Number(ndvi_mean.get('NDVI')).add(ee.Number(0.25).multiply(ee.Number(ndvi_std.get('NDVI'))));
var gndvi_th = ee.Number(gndvi_mean.get('GNDVI')).add(ee.Number(0.25).multiply(ee.Number(gndvi_std.get('GNDVI'))));
var evi_th = ee.Number(evi_mean.get('EVI')).add(ee.Number(0.25).multiply(ee.Number(evi_std.get('EVI'))));
var savi_th = ee.Number(savi_mean.get('SAVI')).add(ee.Number(0.25).multiply(ee.Number(savi_std.get('SAVI'))));

print('NDVI Min, Max, Mean, STD, Threshold = ', minNDVI.get('NDVI'), maxNDVI.get('NDVI'), 
  ndvi_mean.get('NDVI'), ndvi_std.get('NDVI'), ndvi_th);
print('GNDVI Min, Max, Mean, STD, Threshold = ', minGNDVI.get('GNDVI'), maxGNDVI.get('GNDVI'),
  gndvi_mean.get('GNDVI'), gndvi_std.get('GNDVI'), gndvi_th);
print('EVI Min, Max, Mean, STD, Threshold = ', minEVI.get('EVI'), maxEVI.get('EVI'), 
  evi_mean.get('EVI'), evi_std.get('EVI') ,evi_th);
print('SAVI Min, Max, Mean, STD, Threshold = ', minSAVI.get('SAVI'), maxSAVI.get('SAVI'), 
  savi_mean.get('SAVI'), savi_std.get('SAVI') ,savi_th);


// Apply Threshold
var ndvi_filtered = NDVInorm.gt(ndvi_th);
var gndvi_filtered = GNDVInorm.gt(gndvi_th);
var evi_filtered = EVInorm.gt(evi_th);
var savi_filtered = SAVInorm.gt(savi_th);

// Masking to eliminate low vegetation areas
var denseVegNDVI = ndvi_filtered.updateMask(ndvi_filtered);
var denseVegGNDVI = gndvi_filtered.updateMask(gndvi_filtered);
var denseVegEVI = evi_filtered.updateMask(evi_filtered);
var denseVegSAVI = savi_filtered.updateMask(savi_filtered);


// Compute connectivity of pixels to reduce noise and small pixels of vegetation
var NDVIconnections= denseVegNDVI.connectedPixelCount();
var denseVegNDVIclean= denseVegNDVI.updateMask(NDVIconnections.gte(10));

var GNDVIconnections= denseVegGNDVI.connectedPixelCount();
var denseVegGNDVIclean= denseVegGNDVI.updateMask(GNDVIconnections.gte(10));

var EVIconnections= denseVegEVI.connectedPixelCount();
var denseVegEVIclean= denseVegEVI.updateMask(EVIconnections.gte(10));

var SAVIconnections= denseVegSAVI.connectedPixelCount();
var denseVegSAVIclean= denseVegSAVI.updateMask(SAVIconnections.gte(10));

//--------------------DENSE VEGETATION POLYGONS---------------------------------------------//
  
// Convert the dense vegetation masks to polygons for each index
var polygonsNDVI = denseVegNDVIclean.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10  
  });

var polygonsGNDVI = denseVegGNDVIclean.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10
  });
  
var polygonsEVI = denseVegEVIclean.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10
  });
  
var polygonsSAVI = denseVegSAVIclean.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,  
    scale: 10
  });

//--------------------DENSE VEGETATION AREA CALCULATION-------------------------------------//

// Create a raster layer containing the area information of each pixel 
var NDVIdenseVegArea = denseVegNDVIclean.multiply(ee.Image.pixelArea());
var GNDVIdenseVegArea = denseVegGNDVIclean.multiply(ee.Image.pixelArea());
var EVIdenseVegArea = denseVegEVIclean.multiply(ee.Image.pixelArea());
var SAVIdenseVegArea = denseVegSAVIclean.multiply(ee.Image.pixelArea());

// Sum of dense Veg pixels, set besteffort: 'false' for accurate results
var NDVIvegStats = NDVIdenseVegArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var GNDVIvegStats = GNDVIdenseVegArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var EVIvegStats = EVIdenseVegArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var SAVIvegStats = SAVIdenseVegArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

// Get total area (in m²) and convert to hectares
var areaNDVI = NDVIvegStats.get('NDVI');
areaNDVI = ee.Number(areaNDVI).divide(10000).round();
var areaGNDVI = GNDVIvegStats.get('GNDVI');
areaGNDVI = ee.Number(areaGNDVI).divide(10000).round();
var areaEVI = EVIvegStats.get('EVI');
areaEVI = ee.Number(areaEVI).divide(10000).round();
var areaSAVI = SAVIvegStats.get('SAVI');
areaSAVI = ee.Number(areaSAVI).divide(10000).round();

// Print the total area for each vegetation index
print('Total area for NDVI dense vegetation (ha):', areaNDVI);
print('Total area for GNDVI dense vegetation (ha):', areaGNDVI);
print('Total area for EVI dense vegetation (ha):', areaEVI);
print('Total area for SAVI dense vegetation (ha):', areaSAVI);

//------------------------------  DISPLAY PRODUCTS  ----------------------------------------//

// Visualize the dense vegetation
Map.centerObject(aoi, 12);

Map.addLayer(NDVInorm,{},'Normalized NDVI',0);
Map.addLayer(GNDVInorm,{},'Normalized GNDVI',0);
Map.addLayer(EVInorm,{},'Normalized EVI',0);
Map.addLayer(SAVInorm,{},'Normalized SAVI',0);

Map.addLayer(ndvi_filtered,{},'After Threshold NDVI',0);
Map.addLayer(gndvi_filtered,{},'After Threshold GNDVI',0);
Map.addLayer(evi_filtered,{},'After Threshold EVI',0);
Map.addLayer(savi_filtered,{},'After Threshold SAVI',0);

Map.addLayer(medianNDVI,{},'median ndvi',0);
Map.addLayer(medianGNDVI,{},'median gndvi',0);
Map.addLayer(medianSAVI,{},'median savi',0);
Map.addLayer(medianEVI,{},'median evi',0);

Map.addLayer(denseVegNDVIclean, {palette: ['009700']}, 'Dense Vegetation NDVI',0);
Map.addLayer(denseVegGNDVIclean, {palette: ['2faf27']}, 'Dense Vegetation GNDVI',0);
Map.addLayer(denseVegEVIclean, {palette: ['268d1f']}, 'Dense Vegetation EVI',0);
Map.addLayer(denseVegSAVIclean, {palette: ['1d8d64']}, 'Dense Vegetation SAVI',0);

// Visualize the polygons (areas of dense vegetation for each index)
Map.addLayer(polygonsNDVI, {color: '00ff00'}, 'NDVI Vegetation Polygons',0);
Map.addLayer(polygonsGNDVI, {color: '2faf27'}, 'GNDVI Vegetation Polygons',0);
Map.addLayer(polygonsEVI, {color: '268d1f'}, 'EVI Vegetation Polygons',0);
Map.addLayer(polygonsSAVI, {color: '1d8d64'}, 'SAVI Vegetation Polygons',0);


//----------------------------------- EXPORT -----------------------------------------------//

Export.table.toDrive({
  collection: polygonsNDVI,
  description: 'veg_NDVI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsGNDVI,
  description: 'veg_GNDVI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsEVI,
  description: 'veg_EVI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsSAVI,
  description: 'veg_SAVI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});