// Classify Sentinel-2 image using Supervised Classification Algorithms (CART, RF, SVM)
// Identify Developed Areas to remove and delineate areas suitable for riparian zone

//-------------------NOTES-----------------------------------------------------------------------//
// This script:
// 1. Uses Sentinel-2 Harmonized data available on Google Earth Engine to classify the image
// 2. Uses Supervised Classification Algorithms (CART, RF, SVM) to classify the image
// 3. Calculates NDVI and NDWI indices & appends to image to be used for classification
// 4. Calculates accuracy metrics for each classifier and selects the best classifier
// 5. Vectorizes the classified image into polygons for each class
// 6. Exports the polygons to Google Drive
// 7. Uses examples from Google Earth Engine Help Documentation to classify the image
//-----------------------------------------------------------------------------------------------//

//---------------------AREA OF INTEREST-------------------------------------------------------//
// Define area of interest to clip Satellite Image
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

// Define Point to identify Satellite Image
var pt = 
/* color: #d63000 */
/* shown: false */
ee.Geometry.Point([-123.685197463174, 48.7987212936643]);


//---------------------SUPERVISED CLASSIFICATION TRAINING SAMPLES----------------------------//
// Create training samples for each class using Sentinel-2 image and basemap imagery
  var denseveg = 
  /* color: #189436 */
  /* shown: false */
  ee.FeatureCollection(
      [ee.Feature(
          ee.Geometry.Point([-123.69949775609038, 48.80033987253811]),
          {
            "class": 0,
            "system:index": "0"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67413132020762, 48.800725309735654]),
          {
            "class": 0,
            "system:index": "1"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67588094742806, 48.81019183348935]),
          {
            "class": 0,
            "system:index": "2"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66566275816113, 48.80465842984178]),
          {
            "class": 0,
            "system:index": "3"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67172455053479, 48.80137601917151]),
          {
            "class": 0,
            "system:index": "4"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.63492387949269, 48.80419919559333]),
          {
            "class": 0,
            "system:index": "5"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6353927993879, 48.80610918453151]),
          {
            "class": 0,
            "system:index": "6"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.63783897400948, 48.81334435963331]),
          {
            "class": 0,
            "system:index": "7"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64723743439767, 48.81317479716445]),
          {
            "class": 0,
            "system:index": "8"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64919008256051, 48.80938068695377]),
          {
            "class": 0,
            "system:index": "9"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.68008325512437, 48.789142043733094]),
          {
            "class": 0,
            "system:index": "10"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.7190037969651, 48.79678632928141]),
          {
            "class": 0,
            "system:index": "11"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.72807130838989, 48.80691117562948]),
          {
            "class": 0,
            "system:index": "12"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.73332843805908, 48.80532836722203]),
          {
            "class": 0,
            "system:index": "13"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.69238297310267, 48.81650173865779]),
          {
            "class": 0,
            "system:index": "14"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.69066635933314, 48.80559273852985]),
          {
            "class": 0,
            "system:index": "15"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64557518306245, 48.81004100422989]),
          {
            "class": 0,
            "system:index": "16"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66106762233247, 48.810062200894684]),
          {
            "class": 0,
            "system:index": "17"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65635957447985, 48.79764408334009]),
          {
            "class": 0,
            "system:index": "18"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66803157478624, 48.78568216678263]),
          {
            "class": 0,
            "system:index": "19"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70167175243415, 48.817542102754224]),
          {
            "class": 0,
            "system:index": "20"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.71602693508186, 48.81392494858953]),
          {
            "class": 0,
            "system:index": "21"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.62923392222288, 48.80208566006529]),
          {
            "class": 0,
            "system:index": "22"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.63828905985716, 48.80161925719007]),
          {
            "class": 0,
            "system:index": "23"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6464182765629, 48.79529661134469]),
          {
            "class": 0,
            "system:index": "24"
          })]);
  var water = 
  /* color: #2c37ff */
  /* shown: false */
  ee.FeatureCollection(
      [ee.Feature(
          ee.Geometry.Point([-123.70002415210567, 48.806749521009856]),
          {
            "class": 1,
            "system:index": "0"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65479137927852, 48.80584506226442]),
          {
            "class": 1,
            "system:index": "1"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67109921008907, 48.79216313442945]),
          {
            "class": 1,
            "system:index": "2"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67977361825359, 48.779361512044005]),
          {
            "class": 1,
            "system:index": "3"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66993307648896, 48.80215395828421]),
          {
            "class": 1,
            "system:index": "4"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70116712461486, 48.79493117902757]),
          {
            "class": 1,
            "system:index": "5"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70293738256468, 48.79365897953192]),
          {
            "class": 1,
            "system:index": "6"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.71506113503544, 48.79873953635288]),
          {
            "class": 1,
            "system:index": "7"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64348407603725, 48.81050684258835]),
          {
            "class": 1,
            "system:index": "8"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6593896032034, 48.80945185627553]),
          {
            "class": 1,
            "system:index": "9"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67014805112309, 48.80261405897865]),
          {
            "class": 1,
            "system:index": "10"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.57747989328398, 48.81129251488576]),
          {
            "class": 1,
            "system:index": "11"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6664004865457, 48.855812888827934]),
          {
            "class": 1,
            "system:index": "12"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65385795824105, 48.891905357952744]),
          {
            "class": 1,
            "system:index": "13"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.59997141227934, 48.792529812892546]),
          {
            "class": 1,
            "system:index": "14"
          })]);
  var developed = 
  /* color: #7921d1 */
  /* shown: false */
  ee.FeatureCollection(
      [ee.Feature(
          ee.Geometry.Point([-123.65432404876695, 48.799379123618834]),
          {
            "class": 2,
            "system:index": "0"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6866312914383, 48.80706078993144]),
          {
            "class": 2,
            "system:index": "1"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66707821764601, 48.80773995552965]),
          {
            "class": 2,
            "system:index": "2"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6942853182314, 48.785762773290706]),
          {
            "class": 2,
            "system:index": "3"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70411293206196, 48.78457517111452]),
          {
            "class": 2,
            "system:index": "4"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.68905005719074, 48.80203558130525]),
          {
            "class": 2,
            "system:index": "5"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66583955755519, 48.81153851687302]),
          {
            "class": 2,
            "system:index": "6"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65674484306328, 48.811679230847346]),
          {
            "class": 2,
            "system:index": "7"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6489972937798, 48.8152753219956]),
          {
            "class": 2,
            "system:index": "8"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65638677961583, 48.818911805573705]),
          {
            "class": 2,
            "system:index": "9"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66097098613004, 48.78526170934927]),
          {
            "class": 2,
            "system:index": "10"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.665825784447, 48.783586317124154]),
          {
            "class": 2,
            "system:index": "11"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.71729067045804, 48.808966315671064]),
          {
            "class": 2,
            "system:index": "12"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.7156873398658, 48.806393809802536]),
          {
            "class": 2,
            "system:index": "13"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66777308758108, 48.805352269895465]),
          {
            "class": 2,
            "system:index": "14"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.62621851427416, 48.79954069167177]),
          {
            "class": 2,
            "system:index": "15"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.68625233585863, 48.78409488027283]),
          {
            "class": 2,
            "system:index": "16"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.63952306941857, 48.79826270491332]),
          {
            "class": 2,
            "system:index": "17"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65343705067704, 48.78932356985198]),
          {
            "class": 2,
            "system:index": "18"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.69246855626176, 48.79077965464387]),
          {
            "class": 2,
            "system:index": "19"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6961510766941, 48.781586743787045]),
          {
            "class": 2,
            "system:index": "20"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.72087031497534, 48.7823785288388]),
          {
            "class": 2,
            "system:index": "21"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70294216312655, 48.77536280341531]),
          {
            "class": 2,
            "system:index": "22"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.74070728297333, 48.787259386444816]),
          {
            "class": 2,
            "system:index": "23"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.72955926808866, 48.79783152212074]),
          {
            "class": 2,
            "system:index": "24"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.72207054051908, 48.8023967751427]),
          {
            "class": 2,
            "system:index": "25"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.7112357610332, 48.81630599014203]),
          {
            "class": 2,
            "system:index": "26"
          })]);
  var grass = 
  /* color: #ffc82d */
  /* shown: false */
  ee.FeatureCollection(
      [ee.Feature(
          ee.Geometry.Point([-123.63712716277068, 48.81053323379206]),
          {
            "class": 3,
            "system:index": "0"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66526889975493, 48.80934975074241]),
          {
            "class": 3,
            "system:index": "1"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.69409982605751, 48.793307846019445]),
          {
            "class": 3,
            "system:index": "2"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67438022538002, 48.78826110157566]),
          {
            "class": 3,
            "system:index": "3"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.67454255880754, 48.804419554084184]),
          {
            "class": 3,
            "system:index": "4"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6778466570326, 48.785713753316806]),
          {
            "class": 3,
            "system:index": "5"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66839067861132, 48.80423437289543]),
          {
            "class": 3,
            "system:index": "6"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.71001964594882, 48.79273839285876]),
          {
            "class": 3,
            "system:index": "7"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.7073433507991, 48.80725260522194]),
          {
            "class": 3,
            "system:index": "8"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.69406105175736, 48.80304818912202]),
          {
            "class": 3,
            "system:index": "9"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.682835880512, 48.806033117954975]),
          {
            "class": 3,
            "system:index": "10"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.65007052935847, 48.8103702777325]),
          {
            "class": 3,
            "system:index": "11"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.66481195010432, 48.80676673813764]),
          {
            "class": 3,
            "system:index": "12"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.62905612727103, 48.82127640948789]),
          {
            "class": 3,
            "system:index": "13"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64374124063983, 48.80335713073745]),
          {
            "class": 3,
            "system:index": "14"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.6409088279201, 48.806748935185595]),
          {
            "class": 3,
            "system:index": "15"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.64562951578631, 48.82330895164173]),
          {
            "class": 3,
            "system:index": "16"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.70186322238824, 48.82328340699344]),
          {
            "class": 3,
            "system:index": "17"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.63191989843688, 48.81794812853171]),
          {
            "class": 3,
            "system:index": "18"
          }),
      ee.Feature(
          ee.Geometry.Point([-123.74733251074043, 48.79960346143624]),
          {
            "class": 3,
            "system:index": "19"
          })]);

//--------------------SENTINEL-2 PARAMETERS-------------------------------------------------//

// Select the dates 
var startDate = '2023-01-01';
var endDate = '2023-12-31';
  
// Load the Sentinel-2 image collection
var sentinel = ee.ImageCollection('COPERNICUS/S2_HARMONIZED')
    .filterBounds(pt)
    .filterDate(startDate, endDate)
    .sort('CLOUDY_PIXEL_PERCENTAGE')
    .first();

// Function to mask clouds and shadows
function maskCloudsAndShadows(image) {
  var qa = image.select('QA60');
  var cloudBit = 10;
  var shadowBit = 11;
  var clouds = qa.bitwiseAnd(Math.pow(2, cloudBit)).neq(0);
  var shadows = qa.bitwiseAnd(Math.pow(2, shadowBit)).neq(0);
  var mask = clouds.or(shadows).not();
  return image.updateMask(mask);
}

// Apply the cloud and shadow mask
var maskedImage = maskCloudsAndShadows(sentinel);

// Calculate NDVI and NDWI
var ndvi = maskedImage.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndwi = maskedImage.normalizedDifference(['B8', 'B11']).rename('NDWI');

// Add the indices as new bands to the Sentinel-2 image
var sentinelWithIndices = maskedImage.addBands(ndvi).addBands(ndwi);

// Print the result
print('Sentinel-2 Image with NDVI and NDWI', sentinelWithIndices);

// Display the Sentinel-2 image to be used for classification
Map.centerObject(aoi,12);
var visParams={bands:['B4','B3','B2'], min:285, max:1234};
Map.addLayer(sentinelWithIndices , visParams, 'Sentinel 2 Image', 0);


//-------------------- SUPERVISED CLASSIFICATION ----------------------------------------

// Create a feature collection with the training samples created above
var trainingFeatures= ee.FeatureCollection([
    denseveg, water, developed, grass
    ]).flatten();
  
var predictionBands=[
  'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8','B11','B12','NDVI', 'NDWI'];
    
var classifierTraining= sentinelWithIndices.select(predictionBands)
    .sampleRegions({
      collection: trainingFeatures,
      properties: ['class'],
      scale: 10
});
    
var classvis = { min: 0, max: 3, palette: ['green','blue','pink','brown']};

//-------------------- CART CLASSIFIER ----------------------------------------

// Train Classification and Regression Trees (CART) Classifier
var Cartclassifier = ee.Classifier.smileCart().train({
    features: classifierTraining,
    classProperty: 'class',
    inputProperties: predictionBands
  });

// Classify the Sentinel-2 image
var Cartclassified = sentinelWithIndices.select(predictionBands).classify(Cartclassifier);

// Display the classified image
Map.addLayer(Cartclassified, classvis, 'CART classified', 0);  

//-------------------- RF CLASSIFIER ----------------------------------------

// Train Random Forest Classifier
var RFclassifier = ee.Classifier.smileRandomForest(50).train({ 
    features: classifierTraining, 
    classProperty: 'class', 
    inputProperties: predictionBands 
  });
 
// Classify the Sentinel-2 image
var RFclassified = sentinelWithIndices.select(predictionBands).classify( RFclassifier);

// Display the classified image
Map.addLayer(RFclassified, classvis, 'RF classified', 0);

//-------------------- SVM CLASSIFIER ----------------------------------------

// Train Support Vector Machine (SVM) Classifier
var SVMclassifier =  ee.Classifier.libsvm().train({
    features: classifierTraining, 
    classProperty: 'class', 
    inputProperties: predictionBands
    });

// Classify the Sentinel-2 image
var SVMclassified = sentinelWithIndices.select(predictionBands).classify( SVMclassifier);

// Display the classified image
Map.addLayer(SVMclassified, classvis, 'SVM classified', 0);


//--------------------ACCURACY AND CONFUSION MATRIX------------------------------------
  
// Split data into training and testing sets
var trainingTesting= classifierTraining.randomColumn();
var trainingSet = trainingTesting.filter(ee.Filter.lessThan('random',0.7));
var testingSet = trainingTesting.filter(ee.Filter.greaterThanOrEquals('random',0.7));

// Print the training and testing sets
print('Training and Testing Features', trainingTesting);
print('Training Set', trainingSet);
print('Testing Set', testingSet);

// Train CART Classifier with training set----------------------------------------
var CAclassifier = ee.Classifier.smileCart().train({
    features: trainingSet,
    classProperty: 'class',
    inputProperties: predictionBands
});

// Classify and get confusion matrix for CART classifier
var CAconfusionMatrix = testingSet.classify(CAclassifier) 
    .errorMatrix({ 
    actual: 'class', 
    predicted: 'classification' 
    });

// Print the results for CART classifier
print('CART Confusion matrix:', CAconfusionMatrix); 
print('CART Overall Accuracy:', CAconfusionMatrix.accuracy()); 
print('CART Producers Accuracy:', CAconfusionMatrix.producersAccuracy()); 
print('CART Consumers Accuracy:', CAconfusionMatrix.consumersAccuracy()); 
print('CART Kappa:', CAconfusionMatrix.kappa());


// Train RF Classifier with training set----------------------------------------
var RFAclassifier = ee.Classifier.smileRandomForest(50).train({
features: trainingSet,
classProperty: 'class',
inputProperties: predictionBands
});

// Classify and get confusion matrix for RF classifier
var RFconfusionMatrix = testingSet.classify(RFAclassifier) 
    .errorMatrix({ 
    actual: 'class', 
    predicted: 'classification' 
    });

// Print the results for RF classifier
print('RF Confusion matrix:', RFconfusionMatrix); 
print('RF Overall Accuracy:', RFconfusionMatrix.accuracy()); 
print('RF Producers Accuracy:', RFconfusionMatrix.producersAccuracy()); 
print('RF Consumers Accuracy:', RFconfusionMatrix.consumersAccuracy()); 
print('RF Kappa:', RFconfusionMatrix.kappa());


// Train SVM Classifier with training set----------------------------------------
var SVMAclassifier = ee.Classifier.libsvm().train({
features: trainingSet,
classProperty: 'class',
inputProperties: predictionBands
});

// Classify and get confusion matrix for SVM classifier
var SVMconfusionMatrix = testingSet.classify(SVMAclassifier) 
    .errorMatrix({ 
    actual: 'class', 
    predicted: 'classification' 
});

// Print the results for SVM classifier
print('SVM Confusion matrix:', SVMconfusionMatrix); 
print('SVM Overall Accuracy:', SVMconfusionMatrix.accuracy()); 
print('SVM Producers Accuracy:', SVMconfusionMatrix.producersAccuracy()); 
print('SVM Consumers Accuracy:', SVMconfusionMatrix.consumersAccuracy()); 
print('SVM Kappa:', SVMconfusionMatrix.kappa());


//-------------------- VECTORIZATION ----------------------------------------

// Clip classified image to AOI
var ClassAoi= RFclassified.clip(aoi);

// Classification class labels, names, and colors
var classLabels = [0, 1, 2, 3]; 
var classNames = ['dense vegetation', 'water', 'developed', 'grass']; 
var classColors = ['green', 'blue', 'pink', 'brown'];

// Loop through each class and create a polygon for each class
classLabels.forEach(function(classLabel, index) {
  
  // Mask the pixels that belong to the current class
  var classMaskedImage = ClassAoi.eq(classLabel)
    .updateMask(RFclassified.eq(classLabel));
 
 // Convert the masked image into polygons   
  var classPolygons = classMaskedImage.eq(classLabel)  
    .reduceToVectors({
      reducer: ee.Reducer.countEvery(),  
      geometryType: 'polygon',  
      maxPixels: 1e13,
      scale: 10  
    });
  
  // Set the name of the class for each polygon
  classPolygons = classPolygons.map(function(feature) {
    return feature.set('class_name', classNames[index]);
  });

  // Visualize the polygons for the class
  Map.addLayer(classPolygons, {color: classColors[index]}, classNames[index]);

  //Export
  Export.table.toDrive({
    collection: classPolygons,
    description: classNames[index] + '_ClassPolygon',
    folder: 'ee_demos',
    fileFormat: 'GeoJSON',
  });
});