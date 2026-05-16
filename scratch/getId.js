const mongoose = require("mongoose");
const Listing = require("./models/listing");
require('dotenv').config();

async function getId() {
    await mongoose.connect(process.env.ATLASDB_URL);
    const listing = await Listing.findOne({});
    console.log("LISTING_ID:" + listing._id);
    mongoose.connection.close();
}
getId();
