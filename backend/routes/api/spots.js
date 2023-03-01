const express = require('express')
const url = require('url');
const sequelize = require('sequelize')
const { Spot, User, SpotImage, Review, Booking, ReviewImage } = require('../../db/models');
const { setPriority } = require('os');
const { requireAuth } = require('../../utils/auth')
const { Op } = require('sequelize')

const router = express.Router();


router.get('/', async (req, res) => {

    if(req.query.page && req.query.size){
        let {page, size, minLat, maxLat,
            minLng, maxLng, minPrice, maxPrice} = req.query

        page = parseInt(page)
        size = parseInt(size)
        if(Number.isNaN(size) || size <= 0) size = 20;
        if(Number.isNaN(page) || page <= 0) page = 1;
        if(size > 20) size = 20
        if(page > 10) page = 10
        //console.log(size)
        let newSpots = await Spot.findAll({
            limit: size,
            offset: (page - 1) * size
        })
        let paginatedSpots = [] 
        for(let spot of newSpots) { //rename variables later
            newSpot = spot.toJSON();
            //console.log('newSpot: ', newSpot.id)
            const image = await SpotImage.findOne({
                where: {
                    spotId: newSpot.id,
                    //preview: true
                }
            })
            //console.log('image: ', image)
            if(!image){
                newSpot.previewImage = null
            }
            //imagejson = image.toJSON();
            //newSpot.previewImage = image.url
            paginatedSpots.push(newSpot)
        }
        return res.json({
            'Spots': paginatedSpots,
            page,
            size
        })
    }

    // SEARCHING RESULTS
    if(req.query.search){
        let searchValue = req.query.search.toLowerCase();
        let searchSpots = await Spot.findAll({
            include: [
                {model: Review},
                {model: SpotImage}
            ],
            where: {
                name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', '%' + searchValue + '%')
            }
        })
        console.log('inside of searching route====================', searchSpots)
        let searchSpotsResults = [];
        searchSpots.forEach(spot => {
            searchSpotsResults.push(spot.toJSON())
        })

        searchSpotsResults.forEach(spot => {
            let starCount = 0;
            let numRev = 0;
            spot.Reviews.forEach(review => {
                //console.log(review.stars)
                if(review) {
                    //console.log(review)
                    numRev += 1;
                    starCount += review.stars;
                    spot.avgRating = Math.round(starCount/numRev * 10 ) / 10;
                }
            })

            spot.SpotImages.forEach(image => {
                if(!image) {}
                if(image.preview === true) {
                    spot.previewImage = image.url
                }
            })

            if(spot.avgRating === undefined) spot.avgRating = null;
            if(spot.SpotImages.length === 0) spot.previewImage = null;
            delete spot.Reviews;
            delete spot.SpotImages;
        })

        return res.json({
            'Spots': searchSpotsResults
        })
    }

    // *******GET ALL SPOTS NO PAGINATION********
    const allSpots = await Spot.findAll({
        include: [
            {model: Review},
            {model: SpotImage}
        ] 
    });
    //console.log("og spots: ", spots)
    let Spots = [];
    allSpots.forEach(spot => {
        //console.log('New Spots: ', spot.toJSON())
        Spots.push(spot.toJSON())
    })
    
    Spots.forEach(spot => {
        let starCount = 0;
        let numRev = 0;
        spot.Reviews.forEach(review => {
            //console.log(review.stars)
            if(review) {
                //console.log(review)
                numRev += 1;
                starCount += review.stars;
                spot.avgRating = Math.round(starCount/numRev * 10 ) / 10;
            }
        })

        spot.SpotImages.forEach(image => {
            if(!image) {}
            if(image.preview === true) {
                spot.previewImage = image.url
            }
        })

        if(spot.avgRating === undefined) spot.avgRating = null;
        if(spot.SpotImages.length === 0) spot.previewImage = null;
        delete spot.Reviews;
        delete spot.SpotImages;
    })
    return res.json({
        Spots,
    })
})

router.post('/', requireAuth, async (req, res) => {
    const spot = await Spot.create({
        "address": req.body.address,
        "city": req.body.city,
        "state": req.body.state,
        "country": req.body.country,
        "lat": req.body.lat,
        "lng": req.body.lng,
        "name": req.body.name,
        "description": req.body.description,
        "price": req.body.price,
        "ownerId": req.user.id
    });
    res.status(201)
    return res.json(spot)
})

router.get('/current', requireAuth, async (req, res, next) => {
    //console.log(req.user)
    const spots = await Spot.findAll({
        where: { ownerId: req.user.id },
        include: [
            {
                model: Review
            },
            {
                model: SpotImage,
                attributes: ['id', 'url', 'preview']
            }
        ]
            
    })
    let spotList = [];
    spots.forEach(spot => {
        //console.log('New Spots: ', spot.toJSON())
        spotList.push(spot.toJSON())
    })
    spotList.forEach(spot => {
        let starCount = 0;
        let numRev = 0;
        spot.SpotImages.forEach(image => {
            if(!image) {}
            if(image.preview === true) {
                spot.previewImage = image.url
            }
        })
        spot.Reviews.forEach(review => {
            //console.log(review.stars)
            if(review) {
                //console.log(review)
                numRev += 1;
                starCount += review.stars;
            }
            spot.avgRating = Math.round(starCount/numRev * 10) / 10;
        })
        if(spot.SpotImages.length === 0) spot.previewImage = null;
        delete spot.SpotImages;
        if(spot.avgRating === undefined) spot.avgRating = null;
        delete spot.Reviews;
    })
    return res.json({
        'Spots': spotList,
    })
})


router.get('/:spotId', async (req, res, next) => {
    const { spotId } = req.params;
    const spot = await Spot.findOne({
        where: { id: spotId },
        include:[
            {
                model: SpotImage,
                attributes: ['id', 'url', 'preview']
            },
            {
                model: User,
                as: "Owner",
                attributes: ['id', 'firstName', 'lastName']
            },
        ],
    })

    if (!spot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    let newSpot = spot.toJSON();
    newSpot.numReviews = await Review.count({
        where: {
            spotId: spotId
        }
    })
    const reviews = await Review.findAll({
        where: {
            spotId: spotId
        }
    })
    newSpot.SpotImages.forEach(image => {
        if(!image) {}
        if(image.preview === true) {
            newSpot.previewImage = image.url;
        }
    })
    
    let starCount = 0;
    let numRev = 0;
    reviews.forEach(review => {
        const newReview = review.toJSON();
        // console.log(newReview.stars)
        starCount += newReview.stars
        numRev ++
        //numRev += 1
    });
    // console.log(starCount)
    // console.log('numrev: ', numRev)
    newSpot.avgStarRating = starCount/numRev
    newSpot.const
    return res.json(
        newSpot,
    )
})

router.post('/:spotId/images', requireAuth, async (req, res) => {
    const makeSpotImage = await SpotImage.create({
        "url": req.body.url,
        "preview": req.body.preview,
        "spotId": req.params.spotId,
    })
    const spotImage = await SpotImage.findOne({
        where: { spotId: req.params.spotId},
        attributes: { exclude: ['spotId', 'createdAt', 'updatedAt'] },
        order: [['id', 'DESC']]
    })

    const spot = await Spot.findByPk(req.params.spotId)
    if (!spot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    return res.json(
        spotImage
    )
})

router.get('/:spotId/reviews', async (req, res) => {
    const Reviews = await Review.findAll({
        where: { spotId: req.params.spotId},
        include: [ 
            {
                model: User,
                attributes: {exclude: ['username', 'hashedPassword', 'email', 'createdAt', 'updatedAt'] }
            },
            {
                model: ReviewImage,
                attributes: {exclude: ['reviewId', 'createdAt', 'updatedAt'] }
            }  
        ]
    })
    //error handling for if spot does not exist
    const spot = await Spot.findByPk(req.params.spotId)
    if(!spot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    return res.json(
        {Reviews}
    )
})

router.post('/:spotId/reviews', requireAuth, async (req, res) => {
    //error for if a spot cannot be found for a given spot id
    const reviewSpot = await Spot.findByPk(req.params.spotId)
    if (!reviewSpot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    //error for if a review has already been placed by the same user for the targeted spot
    const review = await Review.findOne({
        where: {
            userId: req.user.id,
            spotId: req.params.spotId
        }
    })
    if (review) {
        return res.status(403).json({
            message: "User already has a review for this spot",
            statusCode: 403,
        })
    }
    const makeReview = await Review.create({
        "review": req.body.review,
        "stars": req.body.stars,
        "spotId": Number.parseInt(req.params.spotId),
        "userId": req.user.id,
    })
    
    return res.json(
        makeReview
    )
})

router.put('/:spotId', requireAuth, async (req, res) => {
    const spot = await Spot.findByPk(req.params.spotId)
    if (!spot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    
    spot.address = req.body.address
    spot.city = req.body.city
    spot.state = req.body.state
    spot.country = req.body.country
    spot.lat = req.body.lat
    spot.lng = req.body.lng
    spot.name = req.body.name
    spot.description = req.body.description
    spot.price = req.body.price
    await spot.save();
    return res.json(spot);
})

router.post('/:spotId/bookings', requireAuth, async (req, res) => {
    deconReqStartDate = req.body.startDate.split("-")
    const reqStartDate = new Date(deconReqStartDate).getTime();
    //console.log('start: ', reqStartDate)

    deconReqEndDate = req.body.endDate.split("-")
    const reqEndDate = new Date(deconReqEndDate).getTime();
    //console.log('end: ', reqEndDate)

    const bookings = await Booking.findAll({
        where: {
            spotId: req.params.spotId,
        }
    });

    if(reqStartDate >= reqEndDate){
        return res.status(400).json({
            message: "Validation error",
            statusCode: 400,
            errors: {
              endDate: "endDate cannot be on or before startDate"
            }
        })
    }

    const spot = await Spot.findByPk(req.params.spotId)
    if(!spot){
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }

    const filteredBookings = bookings.filter(booking => {
        //const objBooking = booking.toJSON();
        //console.log('json booking: ', objBooking);
        const bookingStartTime = booking.startDate.getTime();
        const bookingEndTime = booking.endDate.getTime();
        //console.log(`reqstartdate ${reqStartDate}, reqenddate ${reqEndDate}, bookingstarttime ${bookingStartTime}, bookingendtime ${bookingEndTime}`)

        return (reqStartDate >= bookingStartTime && reqStartDate <= bookingEndTime || reqEndDate >= bookingStartTime && reqEndDate <= bookingEndTime )  //create conditions for if new booking timeline wraps existing booking later
    })                                                                                                                                                  // || reqStartDate < bookingStartTime && bookingEndTime > reqEndDate 

    if(filteredBookings.length > 0){
        return res.status(403).json({
            message: "Sorry, this spot is already booked for the specified dates",
            statusCode: 403,
            errors: {
                startDate: "Start date conflicts with an existing booking",
                endDate: "End date conflicts with an existing booking"
            }
        })
    }

    
    
    const booking = await Booking.create({
        "startDate": req.body.startDate,
        "endDate": req.body.endDate,
        "spotId": Number.parseInt(req.params.spotId),
        "userId": req.user.id
    })
    return res.json({
        booking,
        message: "Successfully Booked"
    })
})


router.get('/:spotId/bookings', requireAuth, async (req, res) =>{
    const { spotId } = req.params
    const { id } = req.user

    const spot = await Spot.findByPk(spotId);
    if(!spot){
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }
    const newSpot = spot.toJSON();
    //console.log('owner: ', newSpot)

    if(newSpot.ownerId === req.user.id){
        const userSpotBookings = await Booking.findAll({
            where: {
                spotId: spotId
            },
            include: {
                model: User,
                attributes: { exclude: ['username','createdAt', 'updatedAt', 'hashedPassword', 'email']}
            }
        })
        return res.json(
            userSpotBookings
        )
    }

    const Bookings = await Booking.findAll({
        where: {
            spotId: spotId
        },
        attributes: {
            exclude: ['createdAt', 'updatedAt', 'id', 'userId']
        }
    })
    return res.json({Bookings})

})

//ADD CASCADE TO DELETIONS THAT NEED IT
router.delete('/:spotId', requireAuth, async (req, res) => {
    const {spotId} = req.params
    const spot = await Spot.findOne({
        where: {
            id: spotId
        }
    })
    if (!spot) {
        return res.status(404).json({
            message: "Spot couldn't be found",
            statusCode: 404
        })
    }

    await Spot.destroy({
        where: {
            id: spotId
        }
    })
    return res.status(200).json({
        message: "Successfully deleted",
        statusCode: 200
    })
})



module.exports = router;
