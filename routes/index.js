var express = require('express');
var router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const axios = require('axios');

// if authenticated, go to home page with search bar, else go to landing page
router.get('/', function (req, res, next) {
  req.oidc.isAuthenticated() ?
    res.redirect('home') :
    res.render('index');
});

// go to home page with search bar
router.get('/home', requiresAuth(), (req, res) => {
  res.render('home', { message: req.flash('success') });
});

// for coasters, search discogs and display results
router.post('/search-coasters', requiresAuth(), (req, res) => {
  axios({
    method: 'get',
    url: 'https://api.discogs.com/database/search',
    headers: { 'User-Agent': 'RecordCoasters/1.0' },
    params: {
      q: req.body.searchTerm,
      country: 'US',
      type: 'all',
      format: 'vinyl',
      key: process.env.DISCOGS_CONSUMER_KEY,
      secret: process.env.DISCOGS_CONSUMER_SECRET
    }
  })
    .then(function (response) {
      const results = response.data.results;
      res.render('search-results', { results: results });
    })
    .catch(function (error) {
      console.log('Error searching Discogs database:', error);
      res.send('Error searching Discogs database');
    });
});

// search discogs for specific release via resource_url
router.post('/details', requiresAuth(), (req, res) => {
  axios({
    method: 'get',
    url: req.body.resource_url,
    headers: { 'User-Agent': 'RecordCoasters/1.0' },
    params: {
      country: 'US',
      type: 'all',
      format: 'vinyl',
      key: process.env.DISCOGS_CONSUMER_KEY,
      secret: process.env.DISCOGS_CONSUMER_SECRET
    }
  })
    .then(function (response) {
      const result = response.data;
      const resultObj = {
        result: result,
        artist: result.artists[0].name,
        title: result.title,
        isCoaster: true
      };
      res.render('details', resultObj);
    })
    .catch(function (error) {
      console.log('Error getting Discogs release details:', error);
      res.send('Error getting Discogs release details');
    });
});

// for LP frames
router.post('/search-frames', async function (req, res) {
  // search discogs for LP info/image
  const imageData = await axios({
      method: 'get',
      url: 'https://api.discogs.com/database/search',
      headers: { 'User-Agent': 'RecordCoasters/1.0' },
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
      const cover_image = response.data.results[0].cover_image;
      const title = response.data.results[0].title;
      const resource_url = response.data.results[0].resource_url;
      return {
        cover_image: cover_image,
        title: title,
        resource_url: resource_url
      }
    })
    .catch(function(error) {
      console.log(error);
      res.send('error searching data on discogs');
    });
  
  const cover_image = imageData.cover_image;
  const resource_url = imageData.resource_url;
  
  //get request to resource url for artist and title info
  const albumData = await axios({
    method: 'get',
    url: resource_url,
    headers: { 'User-Agent': 'RecordCoasters/1.0' },
    params: {
      country: 'US',
      type: 'all',
      format: 'vinyl',
      key: process.env.DISCOGS_CONSUMER_KEY,
      secret: process.env.DISCOGS_CONSUMER_SECRET
    }
  })
  .then(function(response) {
    console.log(response.data);
    return response.data
  })
  .catch(function(error) {
    console.log(error);
    res.send('error in get request to resource url on discogs');
  });

  const artist = albumData.artists[0].name;
  const title = albumData.title;

  // use hcti.io API to create LP cover image within a black frame
  async function createFrame() {
    const payload = {
      html: `<div style="height: 250px; width: 250px; border: 10px solid #000000;"><img class="img-fluid" style="height: 250px; width: 250px;" src="${cover_image}" alt="${title}"></div>`
    };

    const headers = {
      auth: {
        username: process.env.HCTI_USER_ID,
        password: process.env.HCTI_API_KEY
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const hctiResponse = await axios.post('https://hcti.io/v1/image', JSON.stringify(payload), headers);
    const image_url = hctiResponse.data.url;

    return image_url;
  }

  const image = await createFrame()
    .then(function(response) {
      return response;
    })
    .catch(function(error) {
      res.send('error creating frame');
    })
  
  const resultObj = {
    artist: artist,
    title: title,
    image: image,
    isCoaster: false,
  };

  res.render('details', resultObj);
});

// save to shopify
router.post('/save', requiresAuth(), (req, res) => {
  const productData = req.body;
  let tags = productData.tags;
  if (typeof (tags) === 'object') {
    tags = tags.join();
  }

  // create product
  axios({
    method: 'post',
    url: `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2023-07/products.json`,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN
    },
    data: {
      product: {
        title: productData.title,
        body_html: productData.body_html,
        images: [{
          src: productData.image
        }],
        variants: [{
          price: productData.price,
          inventory_quantity: productData.quantity,
          sku: productData.sku
        }],
        tags: tags
      }
    }
  })
    .then(function (response) {
      // update inventory item to 'tracked' = true
      const inventoryItemId = response.data.product.variants[0].inventory_item_id;

      return axios({
        method: 'put',
        url: `https://${process.env.SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2023-07/inventory_items/${inventoryItemId}.json`,
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
    .then(function (response) {
      req.flash('success', `"${req.body.title}" successfully saved to Shopify.`);
      res.redirect('home');
    })
    .catch(function (error) {
      console.log('Error saving to Shopify:', error);
      res.send('Error saving to Shopify');
    });
});

module.exports = router;
