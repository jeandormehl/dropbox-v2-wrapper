const $chai = require('chai');
const $expect = $chai.expect;

const DropboxV2Wrapper = require('../lib/dropbox-v2-wrapper');

const _config = {
  refreshToken: '',
};

describe('Dropbox', () => {
  describe('Service', () => {
    const _wrapper = (new DropboxV2Wrapper()).authenticate({
      token: _config.refreshToken,
    });

    it('should check current account', (done) => {
      _wrapper({
        resource: 'users/get_current_account',
      }, (err, result) => {
        $expect(err).to.equal(null);
        $expect(result).to.have.property('account_id');
        $expect(result).to.have.property('name');
        $expect(result).to.have.property('email');
        $expect(result).to.have.property('account_type');

        done();
      });
    });
  });
});
