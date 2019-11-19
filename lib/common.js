module.exports = {
  wrapAsync: function (fn) {
    return function (req, res, next) {
      fn(req, res, next).catch(next);
    }
  },

  get: async function (url, queryString = null) {
    const axios = require('axios');

    try {
      const response = await axios.get(url, { params: queryString });
      return response.data;
    } catch (error) {
      console.error(error);
    }
  },

  post: async function (url, payload, queryString = null) {
    const axios = require('axios');

    try {
      const response = await axios.post(url, payload, { params: queryString });
      return response.data;
    } catch (error) {
      console.error(error);
    }
  },

  multiGet: async function (reqData) {
    const axios = require('axios');

    try {
      let promises = [];
      for (let i = 0; i < reqData.length; i++) {
        let obj = reqData[i];
        const response = axios.get(obj.url, { params: obj.queryString });
        promises.push(response);
      }
      let responses = await Promise.all(promises);
      let resultArr = responses.map((res) => res.data);
      return resultArr;
    } catch (error) {
      console.error(error);
    }
  },

  multiPost: async function (reqData) {
    const axios = require('axios');

    try {
      let promises = [];
      for (let i = 0; i < reqData.length; i++) {
        let obj = reqData[i];
        const response = axios.post(obj.url, obj.payload);
        promises.push(response);
      }
      let responses = await Promise.all(promises);
      let resultArr = responses.map((res) => res.data);
      return resultArr;
    } catch (error) {
      console.error(error);
    }
  },

  sleep: function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  getToday: function (delimiter = '') {
    let today = new Date();
    let dd = today.getDate();
    let mm = today.getMonth() + 1;  // January is 0!
    let yyyy = today.getFullYear();

    if (dd < 10) {
      dd = '0' + dd;
    }

    if (mm < 10) {
      mm = '0' + mm;
    }

    today = yyyy + delimiter + mm + delimiter + dd;  // make sure it's string concatenation
    // today = yyyy + '-' + mm + '-' + dd;
    return today;
  },

  // parameter date -- Date object
  getDate: function (date) {
    let dd = date.getDate();
    let mm = date.getMonth() + 1;  // January is 0!
    let yyyy = date.getFullYear();

    if (dd < 10) {
      dd = '0' + dd;
    }

    if (mm < 10) {
      mm = '0' + mm;
    }

    date = yyyy.toString() + mm + dd;  // make sure it's string concatenation
    return date;
  },

  // check if number is numberic
  isNumeric: function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },

  // get weighted average
  // totalWeight does not include the current iteration's weight
  getWeightedAvg: function (value, weight, totalWeight, weightedAvg) {
    const dotProduct = weightedAvg * totalWeight + value * weight;  // get dot product
    return dotProduct / (totalWeight + weight);
  },

  addDashDate: function (date) {
    return date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8);
  }
}
