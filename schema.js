const joi = require("joi");

const validCategories = [
  "trending", "rooms", "cities", "pools", "hills",
  "star_hotels", "private_house", "best_deals",
  "premium", "nearby", "others"
];

module.exports.listingSchema = joi.object({
  listing: joi.object({
    title: joi.string().required(),
    description: joi.string().required(),
    price: joi.number().required().min(0),
    location: joi.string().required(),
    country: joi.string().required(),
    category: joi.string().valid(...validCategories).default("others"),
    image: joi.object({
      url: joi.string().allow("", null),
      filename: joi.string().allow("", null)
    }),
    images: joi.array().items(joi.object({
      url: joi.string().allow("", null),
      filename: joi.string().allow("", null)
    }))
  }).required()
})

module.exports.reviewSchema = joi.object({
  review: joi.object({
    rating: joi.number().required().min(1).max(5),
    comment: joi.string().required(),
  }).required(),
})