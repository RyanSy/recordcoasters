var express = require('express');
var router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const axios = require('axios');
const { log } = require('console');

router.get('/', function(req, res, next) {
  req.oidc.isAuthenticated() ? 
  res.redirect('home') :
  res.render('index');
});

router.get('/home', requiresAuth(), (req, res) => {
  res.render('home');
});

router.post('/search-results', requiresAuth(), (req, res) => {
  axios({
    method: 'get',
    url: `https://api.discogs.com//database/search?q={${req.body.searchTerm}}&country=US&type=all&key=${process.env.DISCOGS_CONSUMER_KEY}&secret=${process.env.DISCOGS_CONSUMER_SECRET}`,
    headers: {'User-Agent': 'RecordCoasters/1.0'}
  })
  .then(function(response) {
    const results = response.data.results;
    res.render('search-results', { results: results} );
  })
  .catch(function(error) {
    console.log(error);
    res.send('Error searching Discogs');
  })
});

router.post('/save', requiresAuth(), (req, res) => {
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
    console.log(response);
    res.redirect('home');
  })
  .catch(function(error) {
    console.log(error);
    res.send('Error saving to Shopify');
  });
});

module.exports = router;

/**
 * sample discogs response
 * 
 * {
    country: 'US',
    year: '2012',
    format: [ 'Vinyl', 'LP', 'Album' ],
    label: [ 'Community Records', 'Community Records' ],
    type: 'release',
    genre: [ 'Rock', 'Pop' ],
    style: [ 'Punk', 'Indie Rock' ],
    id: 11687894,
    barcode: [ 'L-20683M-A-RE-1 CR-021', 'L-20683M-B RE-1 CR-021' ],
    master_id: 1403581,
    master_url: 'https://api.discogs.com/masters/1403581',
    uri: '/Safety-Night-Lights/release/11687894',
    catno: 'CR-021',
    title: 'Safety (3) - Night Lights',
    thumb: '',
    cover_image: 'https://st.discogs.com/1b4089c0ffa746a52b5ab9f12cc3c7f0ccc9b926/images/spacer.gif',
    resource_url: 'https://api.discogs.com/releases/11687894',
    community: { want: 1, have: 13 },
    format_quantity: 1,
    formats: [ [Object] ]
  }
 */