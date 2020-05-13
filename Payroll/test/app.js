process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');

const should = chai.should();
const fs = require('fs-extra');
const expect = chai.expect;


chai.use(chaiHttp);

describe('App', function copyConfig() {
  let configModified = false;
  this.timeout(10000);
  before(function(done) {
    fs.access(__dirname + '/../config.json', fs.constants.R_OK, (err) => {
      if (!err){
        done();
      }
      configModified = true;
      fs.copy(__dirname + '/../config.test.json', __dirname + '/../config.json', (err) => {
        // console.log('err');
        // console.log(err);
        done();
      })
    });
  });
  // describe('Scheduler', function() {
    it('responds with status 200', function(done) {
      // console.log('including');
      const app = require('../server');
      chai.request(app)
        .get('/status')
        .end((err, res) => {
          console.log('requested');
          // console.log(err);
          res.should.have.status(200);
          done();
        });
    });
  // });
  after(function cleanUpConfig(done) {
    if (configModified)
      fs.unlink(__dirname + '/../config.json', () => {
        done()
      })
  })
});
