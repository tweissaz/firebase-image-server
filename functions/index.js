const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { getStorage } = require('firebase-admin/storage');
const sharp = require("sharp"); // image processing library

admin.initializeApp(); // initialize the firebase app
const storage = getStorage(); // get the default storage bucket

/**
 * Takes a url string and extracts the parameters from within.
 * 
 * Based on the following structure:
 * 
 * {prefix}/width={width}/height={height}/{file_path}
 * @param {String} url 
 * @returns
 */
function extractParams(url){
    // the rewrite prefix for your image serving url
    const prefix = '/files/';

    // slice the prefix off the url string
    url = url.slice(prefix.length);

    let width = null;
    let height = null;
    let fileString = '';

    // split the url into each section between slashes
    let splitUrl = url.split('/');

    // boolean to track when we're done pulling parameters
    let endFlag = false;
    // index of current part of splitUrl
    let partCount = 0;

    for(let part of splitUrl){
        // file path builder
        if(endFlag){
            // we're at the end, start piecing the file path together
            fileString += part;
            if(partCount+1 < splitUrl.length){
                // don't want to add a trailing slash
                fileString += '/';
            }
        }
        // width extractor
        if(part.startsWith('width=')){
            width = part.slice(6); // slice off width=
            try{
                width = Math.round(Number(width));
            } catch {
                width = null;
            }
            if(!splitUrl[partCount+1].startsWith('height=')){
                // height expected right after width, meaning this has no
                // height, just width, need to start grabbing file path
                endFlag = true;
            }
        }
        // height extractor
        if(part.startsWith('height=')){
            height = part.slice(7); //slice off height=
            try {
                height = Math.round(Number(height));
            } catch {
                height = null;
            }
            // height is expected to come after width
            endFlag = true;
        }
        partCount++;
    }

    if(width == null && height == null){
        // no parameters were given, let's return the full url as the
        // fileString (excluding the prefix)
        fileString = url;
    }

    return [width, height, fileString];
}

exports.getImage = onRequest(async (request, response) => {
    // get the parameters for the requested image
    const [width, height, filePath] = extractParams(request.url);

    // checks whether accept header includes webp, if so we'll try to convert
    // this later
    var useWebP = false;
    const acceptHeader = request.header("Accept");
    if(acceptHeader && acceptHeader.indexOf("image/webp") !== -1){
        useWebP = true;
    }

    try{
        // get our storage bucket
        const bucket = storage.bucket();
        // grab requested file
        const file = bucket.file(filePath);
        // get buffer of file
        const [fileContents] = await file.download();

        // .sharp()
        // imports file buffer into sharp object
        // .resize()
        // resizes based on parameters (fit cover crops image to dimensions, 
        // keeping the aspect ratio the same, but outputting the requested 
        // size
        // .webp()
        // converts to webp, force: boolean indicates whether to force to
        // use webp, if false it uses source image format. we can use our
        // useWebP boolean here.
        // .toBuffer()
        // converts image back into a buffer to send to client
        const sendFile = await sharp(fileContents)
            .resize(
                width !== null ? width : undefined,
                height !== null ? height : undefined,
                {
                    fit: "cover"
                })
            .webp({force: useWebP})
            .toBuffer();

        // let requesting browser know we're returning an image
        response.setHeader('Content-Type', 'image');
        // cache-control header, change as needed, see:
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
        response.setHeader('Cache-Control', 'public,max-age=3600');
        // image found, converted successfully, send 200
        response.status(200).send(sendFile);
    } catch (error) {
        if(error.code == 404){        
            // file not found in bucket, could replace this with error image to
            // serve instead of text/html
            response.status(404).send('File not found');
            // could add logger message here if you would like to see missing
            // image that was requested
        } else {
            // something else happened, defaulting to 500 error
            // could also serve an error image here instead.
            response.status(500).send('Error retrieving file');
            // log error and requested url to firebase logger
            logger.error(`Requested URL: ${request.url} Error:`,error);
        }
    }
});