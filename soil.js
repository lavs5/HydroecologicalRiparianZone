// Hydric Soil Extent Detection using Sentinel-2 Satellite Imagery From Google Earth Engine

//--------------------NOTES--------------------------------------------------------------------//
// This script:
// 1. Uses Sentinel-2 multispectral satellite imagery to detect hydric soils extent.
// 2. Calculates three spectral indices: Simple Ratio (SR), Difference Vegetation Index (DVI),
// and Clay Mineral Ratio (CMR).
// 3. Normalizes the indices and thresholds to identify hydric soils pixels.
// 4. Creates masks to exclude pixels in perennial waterbodies.
// 5. Calculates the area of hydric soils pixels detected by each index.
// 6. Visualizes results on the map & exports the hydric soils polygons 
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

// Select the dates after heavy precipitation (Oct 25, Dec 11)
var startDate = '2023-10-01';
var endDate = '2023-12-31';
  
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

// Include JRC layer on surface water seasonality to mask flood pixels from areas
// of "permanent" water (where there is water > 10 months of the year)
var swater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality');

//--------------------CALCULATE INDICES-----------------------------------------------------//

// Map function to calculate DVI, CMR for each image in the collection
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
    var nir = image.select('B8');  // Near-Infrared band
    var swir1 = image.select('B11');  // SWIR1 band
    var swir2 = image.select('B12');  // SWIR2 band
  
  // Calculate SR, DVI, CMR
    
    var sr = nir.divide(red).rename('SR');
    var dvi = nir.subtract(red).rename('DVI');
    var cmr = swir1.divide(swir2).rename('CMR');
  
  // Mask clouds and shadows from each index
    var maskedSR = sr.updateMask(clouds.not().and(shadows.not()));
    var maskedDVI = dvi.updateMask(clouds.not().and(shadows.not()));
    var maskedCMR = cmr.updateMask(clouds.not().and(shadows.not()));
  
  // Add the masked indices as new bands to the image
    return image.addBands(maskedSR).addBands(maskedDVI).addBands(maskedCMR);
});

//--------------------HYDRIC SOIL EXTENT-----------------------------------------------//

// Calculate the median for each index (to avoid outliers due to clouds/shadows)
var medianSR = withIndices.select('SR').median().clip(aoi);
var medianDVI = withIndices.select('DVI').median().clip(aoi);
var medianCMR = withIndices.select('CMR').median().clip(aoi);

// Min-Max normalization--------------------------
// Normalize the indices to a range of [0, 1] for comparison
// Calculate min and max values for each index
var minSR = medianSR.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxSR = medianSR.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var minDVI = medianDVI.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxDVI = medianDVI.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});

var minCMR = medianCMR.reduceRegion({
    reducer: ee.Reducer.min(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});
  
var maxCMR = medianCMR.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: aoi,
  scale: 10,
  maxPixels: 1e13
});
  
// Normalize to [0, 1]
// Normalized index = (index - min(index)) / (max(index) - min(index))
var sr_range= ee.Number(maxSR.get('SR')).subtract(ee.Number(minSR.get('SR')));
var sr_subtctMin = medianSR.subtract(ee.Number(minSR.get('SR')));
var SRnorm = sr_subtctMin.divide(sr_range);

var dvi_range= ee.Number(maxDVI.get('DVI')).subtract(ee.Number(minDVI.get('DVI')));
var dvi_subtctMin = medianDVI.subtract(ee.Number(minDVI.get('DVI')));
var DVInorm = dvi_subtctMin.divide(dvi_range);

var cmr_range= ee.Number(maxCMR.get('CMR')).subtract(ee.Number(minCMR.get('CMR')));
var cmr_subtctMin = medianCMR.subtract(ee.Number(minCMR.get('CMR')));
var CMRnorm = cmr_subtctMin.divide(cmr_range);

// Plot histograms of normalized indices
var srHistogram = ui.Chart.image.histogram({
  image: SRnorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var dviHistogram = ui.Chart.image.histogram({
  image: DVInorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

var cmrHistogram = ui.Chart.image.histogram({
  image: CMRnorm,
  region: aoi,
  scale: 10,
  maxPixels: 1e13
});

print('Normalized SR Histogram',srHistogram);
print('Normalized DVI Histogram',dviHistogram);
print('Normalized CMR Histogram',cmrHistogram);

// Thresholding -----------------------
// Isolates potential soil areas by comparing normalized values to a calculated threshold
// Calculate mean and standard deviation for each index
var sr_mean = SRnorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var sr_std = SRnorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var dvi_mean = DVInorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var dvi_std = DVInorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var cmr_mean = CMRnorm.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

var cmr_std = CMRnorm.reduceRegion({
    reducer: ee.Reducer.stdDev(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e13
});

// Threshold = Mean + k * Standard Deviation
// Different values of k (e.g., 0.1, 0.25, 0.5, 0.01) were evaluated
// k = 0.1 was selected to balance between identification of hydric soils vs. minimizing false positives.
var sr_th = ee.Number(sr_mean.get('SR')).subtract(ee.Number(0.1).multiply(ee.Number(sr_std.get('SR'))));
var dvi_th = ee.Number(dvi_mean.get('DVI')).add(ee.Number(0.1).multiply(ee.Number(dvi_std.get('DVI'))));
var cmr_th = ee.Number(cmr_mean.get('CMR')).subtract(ee.Number(0.1).multiply(ee.Number(cmr_std.get('CMR'))));

print('SR Min, Max, Mean, STD, Threshold = ', minSR.get('SR'), maxSR.get('SR'), sr_mean.get('SR'), sr_std.get('SR'), sr_th);
print('DVI Min, Max, Mean, STD, Threshold = ', minDVI.get('DVI'), maxDVI.get('DVI'), dvi_mean.get('DVI'), dvi_std.get('DVI'), dvi_th);
print('CMR Min, Max, Mean, STD, Threshold = ', minCMR.get('CMR'), maxCMR.get('CMR'), cmr_mean.get('CMR'), cmr_std.get('CMR'), cmr_th);

// Apply Threshold
var sr_filtered = SRnorm.lt(sr_th);
var dvi_filtered = DVInorm.lt(dvi_th);
var cmr_filtered = CMRnorm.lt(cmr_th);

// Masking -----------------------
// Include JRC layer to identify surface water seasonality i.e. areas
// of "permanent" water (where there is water > 10 months of the year)
var swater = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality');
var swater_mask = swater.gte(10).updateMask(swater.gte(10));

// Mask soil pixels in perennial waterbodies
var sr_mask = sr_filtered.where(swater_mask,0);
var dvi_mask = dvi_filtered.where(swater_mask,0);
var cmr_mask = cmr_filtered.where(swater_mask,0);

// final layer without pixels in perennial waterbodies
var sr = sr_mask.updateMask(sr_mask);
var dvi = dvi_mask.updateMask(dvi_mask);
var cmr = cmr_mask.updateMask(cmr_mask);

// Compute connectivity of pixels to eliminate those connected to 10 or fewer neighbours
// This operation reduces noise
var srconnections = sr.connectedPixelCount();    
var sr = sr.updateMask(srconnections.gte(10));

var dviconnections = dvi.connectedPixelCount();    
var dvi = dvi.updateMask(dviconnections.gte(10));

var cmrconnections = cmr.connectedPixelCount();    
var cmr = cmr.updateMask(cmrconnections.gte(10));


//--------------------HYDRIC SOIL POLYGONS---------------------------------------------//
  
// Convert the soil masks to polygons for each index
var polygonsSR = sr.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10  
});

var polygonsDVI = dvi.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10  
});

var polygonsCMR = cmr.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: aoi, 
    bestEffort: true,
    maxPixels: 1e13,
    scale: 10
});
  

//--------------------SOIL EXTENT AREA CALCULATION-------------------------------------//

// Create a raster layer containing the area information of each pixel 
var SRArea = sr.multiply(ee.Image.pixelArea());
var DVIArea = dvi.multiply(ee.Image.pixelArea());
var CMRArea = cmr.multiply(ee.Image.pixelArea());

// Sum of soil pixels, set besteffort: 'false' for accurate results
var SRStats = SRArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var DVIStats = DVIArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});

var CMRStats = CMRArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: aoi, 
  scale: 10,  
  maxPixels: 1e13,
  bestEffort: false
});


// Get total area (in m²) and convert to hectares
var SRAreaHa = SRStats.get('SR');
SRAreaHa = ee.Number(SRAreaHa).divide(10000).round();

var DVIAreaHa = DVIStats.get('DVI');
DVIAreaHa = ee.Number(DVIAreaHa).divide(10000).round();

var CMRAreaHa = CMRStats.get('CMR');
CMRAreaHa = ee.Number(CMRAreaHa).divide(10000).round();


// Print the total area for each index
print('Soil pixels area detected using SR (ha):', SRAreaHa);
print('Soil pixels area detected using DVI (ha):', DVIAreaHa);
print('Soil pixels area detected using CMR (ha):', CMRAreaHa);

//------------------------------  DISPLAY PRODUCTS  ----------------------------------------//

// Visualize the soil pixels
Map.centerObject(aoi, 12);

Map.addLayer(medianSR, {}, 'median SR',0);
Map.addLayer(medianDVI, {}, 'median DVI',0);
Map.addLayer(medianCMR, {}, 'median CMR',0);

Map.addLayer(SRnorm,{},'SR normalized',0);
Map.addLayer(DVInorm,{},'DVI normalized',0);
Map.addLayer(CMRnorm,{},'CMR normalized',0);

Map.addLayer(sr_filtered,{},'SR Threshold',0);
Map.addLayer(dvi_filtered,{},'DVI Threshold',0);
Map.addLayer(cmr_filtered,{},'CMR Threshold',0);

Map.addLayer(sr,{palette:['fe9929']},'SR masked');
Map.addLayer(dvi,{palette:['brown']},'DVI masked');
Map.addLayer(cmr,{palette:['a63603']},'CMR masked');

// Visualize the polygons (areas of soil detected by each index)
Map.addLayer(polygonsSR, {color: 'fe9929'}, 'SR soil Polygons',0);
Map.addLayer(polygonsDVI, {color: 'brown'}, 'DVI soil Polygons',0);
Map.addLayer(polygonsCMR, {color: 'a63603'}, 'CMR soil Polygons',0);


//----------------------------------- EXPORT -----------------------------------------------//
Export.table.toDrive({
  collection: polygonsSR,
  description: 'soil_SR_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsDVI,
  description: 'soil_DVI_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
Export.table.toDrive({
  collection: polygonsCMR,
  description: 'soil_CMR_Polygon',
  folder: 'ee_demos',
  fileFormat: 'GeoJSON',
});
