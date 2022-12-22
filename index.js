const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8no97.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
// console.log(uri)

// verify JWT..
function verifyJWT(req, res, next) {
    console.log('jany')
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next()

    });
}

async function run() {
    try {
        await client.connect()
        const toolsCollection = client.db('bike_equipments').collection('tools')
        const confirmCollection = client.db('bike_equipments').collection('confirm')
        const reviewCollection = client.db('bike_equipments').collection('reviews')
        const customerCollection = client.db('bike_equipments').collection('customer')

        // Read all Tools..
        app.get('/tools', async (req, res) => {
            const query = {}
            const cursor = toolsCollection.find(query)
            const tools = await cursor.toArray();
            res.send(tools)

        })


        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const tool = await toolsCollection.findOne(query)
            res.send(tool)
        })

        // add/post a (tool)
        app.post('/tools',async(req,res)=>{
            const tool=req.body;
            console.log(tool)
            const result= await toolsCollection.insertOne(tool)
            res.send(result)

        })

        // post/create (confirm)....
        app.post('/confirm', async (req, res) => {
            const confirm = req.body;
            console.log('confirm server', confirm)
            const query = { toolName: confirm.toolName, email: confirm.email, name: confirm.name }
            const exists = await confirmCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, confirm: exists })
            }
            const result = await confirmCollection.insertOne(confirm)
            return res.send({ success: true, result })
        })

        // Read/get (confirm)...for (My order) page
        app.get('/confirm', verifyJWT, async (req, res) => {
            const email = req.query.email
            // const authorization=req.headers.authorization
            // console.log('auth hedaer',authorization)
            const query = { email: email }
            const confirm = await confirmCollection.find(query).toArray()
            res.send(confirm)
        })

         // Read/get (confirm)...for (Payment) page
        app.get('/confirm/:id',async(req,res)=>{
            const id =req.params.id;
            const query={_id:ObjectId(id)}
            const confirm =await confirmCollection.findOne(query)
            res.send(confirm)
        })

        // paymet Intent ..
        app.post('/create-payment-intent', async (req,res)=>{
            const service=req.body
            const price=service.price
            const amount=price*100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
              });
            res.send({clientSecret: paymentIntent.client_secret})
        })

        // post/create (add Reviews)
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            console.log(review)
            const result = await reviewCollection.insertOne(review)
            res.send({ success: true, result })
        })

        // Read/get (all reviews)
        app.get('/reviews', async (req, res) => {
            const query = {}
            const cursor = reviewCollection.find(query)
            const reviews = await cursor.toArray()
            res.send(reviews)
        })

        // Put/update...
        app.put('/customer/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const customer = req.body;
            console.log(customer)
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: customer,
            };
            const result = await customerCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2720h' })
            res.send({ result, token })
        })

        // get/Read all (customers)..
        app.get('/customer', verifyJWT, async (req, res) => {
            const customers = await customerCollection.find().toArray()
            res.send(customers)
        })

        //  Admin create..
        app.put('/customer/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const requester = req.decoded.email;
            const requesterAcount = await customerCollection.findOne({email:requester})
            if (requesterAcount.role === 'admin') {
                const filter = { email: email }

                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await customerCollection.updateOne(filter, updateDoc)

                res.send(result)
            }
            else{
                res.status(403).send({message:'Forbidden'})
            } 

        })
        
        
        // get/Read (admin) for create (Require Admin)
        app.get('/admin/:email',async( req,res)=>{
            const email=req.params.email;
            const customer=await customerCollection.findOne({email:email})
            const isAdmin=customer.role==='admin'
            res.send({admin:isAdmin})
        })

        
    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello Bike')
})
app.listen(port, () => {
    console.log('listening to port', port)
})