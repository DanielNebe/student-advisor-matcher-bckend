// clean-db.js
require('dotenv').config();
const mongoose = require('mongoose');

const uri = 'mongodb+srv://project_user:nebechukwudaniel123@clusterrs.d6sy4bu.mongodb.net/student-advisor?retryWrites=true&w=majority';

async function cleanDatabase() {
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
    
    // Delete all users
    const User = require('./models/User');
    await User.deleteMany({});
    console.log('✅ All users deleted');
    
    // Drop the problematic index
    await mongoose.connection.db.collection('users').dropIndex('email_1');
    console.log('✅ Email index dropped');
    
    console.log('🎉 Database cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanDatabase();