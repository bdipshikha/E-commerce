var express = require('express')
var app = express();

//templating stuff
var ejs = require("ejs")
app.set("view engine", "ejs")
    //body parser
var bodyParser = require('body-parser')
    //tell app which method to use when parsing
app.use(bodyParser.urlencoded({
    extended: false
}))

//method override setup
var methodOverride = require('method-Override')
    //tell app which override method to use
app.use(methodOverride('_method'))

//allow sqlite3
var sqlite3 = require('sqlite3').verbose();
//set database
var db = new sqlite3.Database('./sparkledb/sparkle.db');

// tell app to use stripe
var stripe = require("stripe")('api_key');


// allow session
var session = require("express-session");

// allow bcrypt
var bcrypt = require("bcrypt");

// allow 
var secret = require('./secret.json');


app.use(session({
    secret: secret.password,
    resave: false,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({
    extended: false
}));


app.get('/', function(req, res) {
    res.redirect('/sparkles')
});

// to get all the categories
app.get('/sparkles', function(req, res) {
    db.all("SELECT * FROM categories;", function(err, data) { // db for database not the name of database
        var sparkle = data;
        var admin = false;
        if (req.session != null) {
            admin = req.session.valid_user;
        } 
        res.render('index.ejs', {
            sparkle: sparkle,
            admin: admin
        });

    });
});


// to get single category
app.get('/sparkle/:id', function(req, res) {
    var id = req.params.id;
    db.get("SELECT * FROM categories WHERE id = ?", id, function(err, thisCategory) {
        var category_row = thisCategory;
        var category_id = req.params.id

        db.all("SELECT items.id, items.name, items.image FROM items INNER JOIN categories ON categories.id = items.category_id WHERE category_id = ?;", thisCategory.id, function(err, items) {
            var admin = false;
            if (req.session != null) {
                admin = req.session.valid_user;
            }
            res.render('show-category.ejs', {
                'category': category_row,
                'items': items,
                'admin': admin
            });

        });
    });
});


// for new category 
app.get('/categories/new', function(req, res) {
    res.render('new-category.ejs')
});

app.post('/categories', function(req, res) {

    //get info from req.body, make new category
    db.run("INSERT INTO categories (name, image) VALUES (?, ?)", req.body.name, req.body.image, function(err) {
        if (err) {
            throw err;
        } else {
            console.log("Created a new category");
        }
    });
    //go to sparkle to can see the new category
    res.redirect('/sparkles')
});

app.get('/sparkle/:id/edit', function(req, res) {
    var id = req.params.id
    db.get("SELECT * FROM categories WHERE id = ?", id, function(err, thisCategory) {
        if (err) {
            throw err
        } else {
            res.render("edit-category.ejs", {
                thisCategory: thisCategory
            })
        }
    });
});
app.put('/sparkle/:id', function(req, res) {

    //make changes to appropriate category
    db.run("UPDATE categories SET name = ?, image = ?  WHERE id = ?", req.body.name, req.body.image, req.params.id, function(err) {
            if (err) {
                throw err
            } // console.log(res)
        })
        //redirect to this individual category page to see changes
    res.redirect('/sparkle/' + req.params.id)
});


app.delete("/sparkle/:id", function(req, res) {
    db.get("DELETE  FROM categories WHERE id = ?", req.params.id, function(err, categories) {
        if (err) {
            throw err;
        } else {
            console.log("It deleted!");
        }
    });
    res.redirect('/sparkles')
});

// ************************ Item stars here *****************************

app.get('/item/:id', function(req, res) {
    var id = req.params.id
    db.get("SELECT * FROM items WHERE id = ?", id, function(err, thisItem) {
        var item_row = thisItem;
        var admin = false;
        if (req.session != null) {
            admin = req.session.valid_user;
        }
        console.log('******** ' + admin + ' *********')

        res.render('show-item.ejs', {
            item: item_row,
            admin: admin
        })
    });
});


// for new item
app.get('/category/:id/items/new', function(req, res) {
    var cid = req.params.id;
    res.render('new-item.ejs', {
        'category_id': cid
    })
});

app.post('/category/:catid/item/savenewitem', function(req, res) {
    var catid = req.params.catid;

    //get info from req.body, make new item
    db.run("INSERT INTO items (category_id, name, image, quantity, price) VALUES (?, ?, ?, ?, ?);", catid, req.body.name, req.body.image, req.body.quantity, req.body.price,
        function(err) {
            if (err) {
                console.log("Inserting work!");
                throw err;
            } else {
                console.log("No error");
            }
            res.redirect('/sparkle/' + catid);
        });
    //go to sparkle so we can see our new category

});
app.get('/item/:id/edit', function(req, res) {
    var id = req.params.id
    db.get("SELECT * FROM items WHERE id = ?", id, function(err, thisItem) {
        if (err) {
            throw err
        } else {
            res.render("edit-item.ejs", {
                thisItem: thisItem
            })
        }
    });
});

app.put('/item/:id/update', function(req, res) {

    db.run("UPDATE items SET  name = ?, image = ?,  quantity = ?, price = ? WHERE id = ?", req.body.name,
        req.body.image, req.body.quantity, req.body.price, req.params.id,
        function(err) {
            if (err) {
                throw err
            } // console.log(res)
        });
    //redirect to this to see changes
    res.redirect('/item/' + req.params.id)
});


app.delete("/item/:id", function(req, res) {
    db.run("DELETE FROM items WHERE id = ?", req.params.id, function(err) {
        if (err) {
            throw err
        }
    });
    //go to specific category to see change
    res.redirect('/sparkles')
});

app.get('/item/:id/add-to-shopping-cart', function(req, res) {
    var id = req.params.id;

    db.get("SELECT items.id, items.name, items.price, items.quantity FROM items WHERE id = ?", id, function(err, item) {
        if (err) {
            throw err
        } else {

            // console.log(JSON.stringify(item));

            var newCartItem = {};
            newCartItem.itemiId = id;
            newCartItem.itemQty = 1;
            newCartItem.itemPrice = item.price;
            newCartItem.itemName = item.name;

            if (req.session.cart == null) req.session.cart = [];
            req.session.cart.push(newCartItem);

            res.redirect('/cart')
        }
    });

});


app.get('/cart', function(req, res) {
    res.render('shopping-cart.ejs', {
        'cart': req.session.cart
    })
});

app.post('/item/:id/add-to-shopping-cart', function(req, res) {
    db.run("INSERT INTO carts (item_id, session_id, item_name, item_price, item_quantity) VALUES (?, ?, ?, ?, ?)", req.body.item_id, req.body.session_id, req.body.item_name, req.body.item_price, req.body.quantity, function(err) {
        if (err) {
            throw err
        } else {

        }
    });
});

app.get('/order', function(req, res) {
    var cid = req.params.id;

    var total = 0;
    if (req.session != null && req.session.cart != null) {
        for (var idx = 0; idx < req.session.cart.length; idx++) {
            total = total + req.session.cart[idx].itemQty * req.session.cart[idx].itemPrice
        }
    }

    res.render('order.ejs', {
        item_id: cid,
        'total': total
    });
});

// app.post('/order', function(req, res) {
//     var id = req.params.id;
//     db.run("INSERT INTO orders (item_name, item_id, item_quantity, item_price) VALUES (?, ?, ?, ?);", id, req.body.item_name, req.params.item_id, req.params.item_price, req.params.item_quantity, function(err) {
//             if (err) {
//                 throw err 
//             }
//     });
//     res.render('order.ejs', { id: id })
// });

// ****************************** user starts here ************************************

app.get('/login', function(req, res) {
    res.sendFile(__dirname + '/public/main.html');

});

// creating admin
app.post('/create-user', function(req, res) {
    var username = req.body.username;
    var formPassword = req.body.password;
    var confirm_password = req.body.confirm_password;


    if (formPassword != confirm_password) {
        res.redirect('/login');
    } else {
        var hash = bcrypt.hashSync(formPassword, 10);

        db.run("INSERT INTO users (username, password) VALUES (?, ?)", username, hash, function(err) {
            if (err) {
                throw err;
            }
            req.session.valid_user = true;
            res.redirect('/sparkles');
        });
    }
});

app.post('/create-session', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    db.get("SELECT * FROM users WHERE username = ?", username, function(err, row) {
        if (err) {
            throw err;
        }
        if (row) {
            var passwordMatches = bcrypt.compareSync(password, row.password);
            if (passwordMatches) {
                req.session.valid_user = true;
                req.user = row.username;
                res.redirect('/sparkles');
            } else {
                res.redirect('/login');
            }
        } else {
            res.redirect('/login');
        }
    });
});

// to logout and kill session
app.post('/logout', function(req, res) {
    // console.log(req.session.valid_user)
    req.session.destroy(function(err) {
        if (err) {
            throw (err)
        } else {
            // console.log(req.session)
            res.redirect('/login')
        }
    });
});


// app.get('/', function(req, res) {
//     db.run("INSERT INTO orders (item_name, item_id, item_quantity, item_price) VALUES (?, ?, ?, ?);", "myitemname", 123, 2, 100, function(err) {
//         if (err) {
//             throw err
//         }
//         console.log("12345678")
//     });
//     res.redirect('/order')
// });





// ******************************** card charge ******************************

// setup stripe with test API key
// Create a new customer and then a new charge for that customer:

app.post('/order', function(req, res) {
    var stripeToken = req.body.stripeToken;
    var charge = stripe.charges.create({
        amount: parseInt(req.body.amount) * 100, // amount in cents, again
        currency: "usd",
        source: stripeToken,
        description: "Example charge"
    }, function(err, charge) {
        if (err && err.type === 'StripeCardError') {

        } else {
            // console.log(res)
            db.run("INSERT INTO orders (item_name, item_id, item_quantity, item_price) VALUES (?, ?, ?, ?);", req.params.id, req.body.item_name, req.body.item_id, req.body.item_quantity, req.body.item_price, function(err) {
                if (err) {
                    throw err
                }
  
                res.send('Your order has been processed. Your card will be charged with $' + req.body.amount +
                    '. Your item will be shipped to the billing address. Thank you for shopping with us!');
                res.end();
            });
        }
    });
});

app.listen('3000')
console.log("Listing to port 3000")