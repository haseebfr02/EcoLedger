from flask_pymongo import PyMongo
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

mongo = PyMongo()

def init_db(app):
    # Get Mongo URI from environment variable
    mongo_uri = os.getenv("LEADS_DB_URI")

    if not mongo_uri:
        raise ValueError("⚠️ MONGO_URI not found in environment variables")

    app.config["MONGO_URI"] = mongo_uri
    mongo.init_app(app)
    return mongo
