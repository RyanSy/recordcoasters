var express = require('express');
var router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const axios = require('axios');
const { log } = require('console');

// if authenticated, go to home page with search bar, else go to landing page
router.get('/', function(req, res, next) {
  req.oidc.isAuthenticated() ? 
  res.redirect('home') :
  res.render('index');
});

// go to home page with search bar
router.get('/home', requiresAuth(), (req, res) => {
  res.render('home');
});

// search discogs and display results
router.post('/search-results', requiresAuth(), (req, res) => {
  axios({
    method: 'get',
    url: 'https://api.discogs.com/database/search',
    headers: {'User-Agent': 'RecordCoasters/1.0'},
    params: {
      q: req.body.searchTerm,
      country: 'US',
      type: 'all',
      format: 'vinyl',
      key: process.env.DISCOGS_CONSUMER_KEY,
      secret: process.env.DISCOGS_CONSUMER_SECRET
    }
  })
  .then(function(response) {
    const results = response.data.results;
    res.render('search-results', { results: results} );
  })
  .catch(function(error) {
    console.log(error);
    res.send('Error searching Discogs database');
  });
});

// search discogs for specific release via resource_url
router.post('/details', requiresAuth(), (req, res) => {
  axios({
    method: 'get',
    url: req.body.resource_url,
    headers: {'User-Agent': 'RecordCoasters/1.0'},
    params: {
      country: 'US',
      type: 'all',
      format: 'vinyl',
      key: process.env.DISCOGS_CONSUMER_KEY,
      secret: process.env.DISCOGS_CONSUMER_SECRET
    }
  })
  .then(function(response) {
    const result = response.data;
    const resultObj = {
      result: result,
      title: req.body.title
    }
    res.render('details', resultObj);
  })
  .catch(function(error) {
    console.log(error);
    res.send('Error getting Discogs release details');
  });
});

// save to shopify
router.post('/save', requiresAuth(), (req, res) => {
  // create product
  axios({
    method:'post',
    url: 'https://recordcoasters.myshopify.com/admin/api/2023-07/products.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN 
    },
    data: {
      product: {
        title: req.body.title,
        images: [{
          src: req.body.image
        }],
        variants: [{
          price: req.body.price,
          inventory_quantity: req.body.quantity
        }]
      }
    }
  })
  .then(function(response) {
    // update inventory item to 'tracked' = true
    const inventoryItemId = response.data.product.variants[0].inventory_item_id;

    return axios({
      method:'put',
      url: `https://recordcoasters.myshopify.com/admin/api/2023-07/inventory_items/${inventoryItemId}.json`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN 
      },
      data: {
        inventory_item: {
          tracked: true
        }
      }
    });
  })
  .then(function(response) {
    res.redirect('home');
  })
  .catch(function(error) {
    console.log('error saving to Shopify:', error);
    res.send('Error saving to Shopify');
  });
});

module.exports = router;
