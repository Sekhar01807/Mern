const express = require("express");
const router = express.Router()
const wrapAsync = require("../utils/wrapAsync.js");
const { index, renderNewForm, showListing, createListing, editListing, updateListing, deleteListing } = require("../controllers/listings.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const multer = require('multer')
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage })

router
  .route("/")
  .get(wrapAsync(index)) // index
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(createListing)); // create

router.get("/new", isLoggedIn, renderNewForm); //new route   

router
  .route("/:id")
  .get(wrapAsync(showListing)) //show route
  .put(isLoggedIn, isOwner, upload.single("listing[image]"), validateListing, wrapAsync(updateListing)) // update route
  .delete(isLoggedIn, isOwner, wrapAsync(deleteListing)) //Delete route

router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(editListing)); // edit Route 


module.exports = router;
