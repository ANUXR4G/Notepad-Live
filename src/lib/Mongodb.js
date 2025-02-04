

import { MongoClient, ServerApiVersion } from "mongodb";

const uri = "mongodb+srv://kumararvindra7691:2BJ6FtigJFfPcd7F@cluster1.8tgz2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1";
console.log("MongoDB URI:", process.env.MONGODB_URI);

if (!uri) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}



const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global;

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;