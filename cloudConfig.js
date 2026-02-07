const cloudinary = require("cloudinary");
const CloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});
console.log("cloudinary.v2 exists:", !!cloudinary.v2);
console.log("uploader exists:", !!cloudinary.v2.uploader);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'wanderlust_DEV',
        allowedFormats: ["png", "jpg", "jpeg"],
    },
});

module.exports = {
    cloudinary,
    storage
}
