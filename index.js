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

// Endpoint to generate and save images
app.post('/generate', async (req, res) => {
    try {
        const { text, height, width, model, count } = req.body;

        if (!text) {
            return res.status(400).json({ error: true, msg: 'The "text" field is required.' });
        }

        // Call the image generation function
        const result = await genDallE(text, height, width, model, count);
        console.log('genDallE result:', result);  // Log the result to debug

        // Check if result is an array
        if (Array.isArray(result)) {
            // Concurrently download and save all images
            const savedImages = await Promise.all(
                result.map(async (item) => {
                    const imageUrl = item.attrs.src;
                    if (!imageUrl) return null; // Skip if no image URL

                    const uniqueFileName = `${uuidv4()}.png`;
                    const savedImagePath = await saveImageToDisk(imageUrl, uniqueFileName);

                    // Return metadata
                    return {
                        generated_link: savedImagePath,
                        prompt: item.attrs.query,
                        width: item.attrs.meta.width,
                        height: item.attrs.meta.height,
                        createdTime: item.createdTime,
                    };
                })
            );

            // Filter out null values (failed downloads)
            const successfulImages = savedImages.filter(Boolean);

            res.json({
                success: true,
                count: successfulImages.length,
                generated_images: successfulImages,
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
