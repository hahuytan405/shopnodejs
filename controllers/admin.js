const { validationResult } = require('express-validator');
const fileHelper = require('../util/file');
const path = require('path');

const Product = require('../models/product');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const fs = require('fs');
const KEYFILEPATH = path.join(__dirname, 'ServiceAcccoutCred.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;
  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      errorMessage: 'Attached file is not an image.',
      validationErrors: [],
    });
  }
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        imageUrl: imageUrl,
        price: price,
        description: description,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  const filemetadata = {
    name: image.filename,
    parents: ['1mkUjhei3l-yD-i22Oq_SX037Q9RfcJY3'],
  };
  const media = {
    mimeType: image.mimetype,
    body: fs.createReadStream(image.path),
  };
  drive.files
    .create({
      resource: filemetadata,
      media: media,
      fields: 'id',
    })
    .then(result => {
      console.log(result.data.id);
      imageUrl = result.data.id;
      const product = new Product({
        // _id: new mongoose.Types.ObjectId('6440f5e61e821bb575c333bb'),
        title: title,
        price: price,
        description: description,
        imageUrl: imageUrl,
        userId: req.user,
      });
      return product;
    })
    .then(product => {
      product
        .save()
        .then(result => {
          // console.log(result);
          console.log('Created Product');
          res.redirect('/admin/products');
        })
        .catch(err => {
          const error = new Error(err);
          error.httpStatusCode = 500;
          return next(error);
        });
    })
    .catch(err => {
      console.log(err);
    });
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      errorMessage: 'Attached file is not an image.',
      validationErrors: [],
    });
  }

  Product.findById(prodId)
    .then(product => {
      if (product.userId.toString() !== req.user._id.toString()) {
        console.log();
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        drive.files.delete({
          fileId: product.imageUrl,
        });
        const filemetadata = {
          name: image.filename,
          parents: ['1mkUjhei3l-yD-i22Oq_SX037Q9RfcJY3'],
        };
        const media = {
          mimeType: image.mimetype,
          body: fs.createReadStream(image.path),
        };
        drive.files
          .create({
            resource: filemetadata,
            media: media,
            fields: 'id',
          })
          .then(result => {
            product.imageUrl = result.data.id;
            return product.save().then(result => {
              console.log('UPDATED PRODUCT!');
              res.redirect('/admin/products');
            });
          })
          .catch(err => {
            console.log(err);
          });
      } else {
        return product.save().then(result => {
          console.log('UPDATED PRODUCT!');
          res.redirect('/admin/products');
        });
      }
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    // .select('title price -_id')
    // .populate('userId', 'name')
    .then(products => {
      res.render('admin/products', {
        prods: products,
        pageTitle: 'Admin Products',
        path: '/admin/products',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      if (!product) {
        return next(new Error('Product not found'));
      }
      drive.files.delete({
        fileId: product.imageUrl,
      });
      return Product.deleteOne({ _id: prodId, userId: req.user._id });
    })
    .then(() => {
      console.log('DESTROYED PRODUCT');
      res.status(200).json({ message: 'Successfully deleted! ' });
    })
    .catch(err => {
      res.status(500).json({ message: 'Deleting product failed!' });
    });
};
