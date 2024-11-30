const express = require('express');
const fs = require('fs'); // For file handling
const path = require('path'); // For working with file paths
const axios = require('axios'); // For HTTP requests
const { v4: uuidv4 } = require('uuid'); // For unique file names
const { genDallE } = require('./lib/gen-image'); // Assuming you have the genDallE function in this file
require('dotenv').config();

const port = process.env.PORT || 5000;
const app = express();

// Ensure static folder exists
const STATIC_FOLDER = 'generated-images';
const STATIC_PATH = path.join(__dirname, STATIC_FOLDER);
if (!fs.existsSync(STATIC_PATH)) {
    fs.mkdirSync(STATIC_PATH);
}

// Middleware
app.use(express.json());

// Function to download and save an image to disk
const saveImageToDisk = async (imageUrl, filename) => {
    const filePath = path.join(STATIC_PATH, filename);

    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer', // Fetch image as binary data
        });

        // Write binary data to disk
        await fs.promises.writeFile(filePath, response.data);

        return `/generated-images/${filename}`; // Relative path for serving
    } catch (error) {
        console.error(`Error saving image ${filename}:`, error.message);
        throw error;
    }
};

// Endpoint to generate and save images using URL parameters
app.get('/generate', async (req, res) => {
    try {
        // Extract the parameters from URL query
        const { text, height, width, model, count } = req.query;

        if (!text) {
            return res.status(400).json({ error: true, msg: 'The "text" field is required.' });
        }

        // Use default values if optional parameters are not provided
        const imageHeight = height || 1024;
        const imageWidth = width || 1024;
        const imageCount = count || 1;
        const imageModel = model || 'dall-e-3';

        // Call the image generation function
        const result = await genDallE(text, imageHeight, imageWidth, imageModel, imageCount);
        console.log('genDallE result:', result);  // Log the result to debug

        // Check if result is an array
        if (Array.isArray(result)) {
            // Create a list of image URLs
            const imageLinks = await Promise.all(
                result.map(async (item) => {
                    const imageUrl = item.attrs.src;
                    if (!imageUrl) return null; // Skip if no image URL

                    const uniqueFileName = `${uuidv4()}.png`;
                    const savedImagePath = await saveImageToDisk(imageUrl, uniqueFileName);

                    // Return image path
                    return `https://5a76b7cd-f475-4b38-9703-d660d4f4d38a-00-1ke95l152ljgi.kirk.replit.dev${savedImagePath}`;
                })
            );

            // Filter out null values (failed downloads)
            const successfulImages = imageLinks.filter(Boolean);

            // Create the response object dynamically based on the number of images
            const imageFields = successfulImages.reduce((acc, url, index) => {
                acc[`img_${index + 1}`] = url; // Generate dynamic keys like img_1, img_2, etc.
                return acc;
            }, {});

            // Structure response data with dynamic keys
            res.json({
                "TG : @PakCyberXpert": [
                    imageFields
                ]
            });
        } else {
            // Handle case when genDallE does not return an array
            res.status(500).json({
                error: true,
                msg: 'The result from genDallE is not an array.',
            });
        }
    } catch (error) {
        console.error('Error generating image:', error.message);
        res.status(500).json({
            error: true,
            msg: error.message || 'Unknown error occurred.',
        });
    }
});

// Serve static files from the generated images folder
app.use('/generated-images', express.static(STATIC_PATH));

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});
