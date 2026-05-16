if (process.env.NODE_ENV != "production") {
    require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
}
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const dbUrl = process.env.ATLASDB_URL;

main()
.then(() => { console.log("connected to DB"); })
.catch((err) => { console.log(err); });

async function main() {
    await mongoose.connect(dbUrl);
}

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

const initDB = async () => {
    await Listing.deleteMany({});
    
    console.log("Starting bulk geocoding for seeded data...");
    
    const preparedData = [];
    for (let obj of initData.data) {
        try {
            const response = await geocodingClient.forwardGeocode({
                query: `${obj.location}, ${obj.country}`,
                limit: 1
            }).send();

            let geometry = { type: 'Point', coordinates: [78.4867, 17.3850] }; // Default fallback
            if (response.body.features.length > 0) {
                geometry = response.body.features[0].geometry;
            }

            preparedData.push({
                ...obj,
                owner: "672ef4689a83bb82eac61046",
                geometry: geometry
            });
            console.log(`Geocoded: ${obj.title}`);
        } catch (e) {
            console.error(`Error geocoding ${obj.title}:`, e.message);
            preparedData.push({ ...obj, owner: "672ef4689a83bb82eac61046", geometry: { type: 'Point', coordinates: [78.4867, 17.3850] } });
        }
    }

    await Listing.insertMany(preparedData);
    console.log("Data initialized successfully with accurate coordinates!");
    mongoose.connection.close();
};

initDB();
