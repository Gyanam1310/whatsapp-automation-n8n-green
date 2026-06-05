const mb = require('../frontend/messageBuilder.js');

const data = {
  postType: 'Birthday',
  donationType: 'एक समय का गौ-आहार प्रदान कर्ता है :-',
  donors: [{ name: 'KALYANMAL JI BHALGAT' }],
  mainPersonName: 'GYANAM BHALGAT',
  familyName: 'Bhalgat'
};

console.log(mb.generateMessage(data));
