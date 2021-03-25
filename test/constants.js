'use strict'

const { readFileSync } = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')

const domain = 'https://localhost/'

const jwks = {
  keys: [
    {
      alg: 'RS512',
      kid: 'KEY_0',
      e: 'AQAB',
      kty: 'RSA',
      n:
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImp0aSI6ImZmMTBmMTg1LWFiODEtNDhjYS1hZmI1LTdkY2FhMzNmYzgzNSIsImlhdCI6MTYxNDEwMzkxNiwiZXhwIjoxNjE0MTA3NTE2fQ.mLx1TZaHDhcymZFmLM7pfBhowY7CEgjuxr54LPXpGXc',
      use: 'sig',
    },
    {
      alg: 'RS256',
      kid: 'KEY_1',
      e: 'AQAB',
      kty: 'RSA',
      n:
        '7KRDtHuJ9-R1cYzB9-E4TUVazzv93MMmMo_38nOwEKNxlWs7OVg397d0SCsdmBbcbr4KTMeblY4a-VOzLVZ5ycYgi7ZbMvv7RzunKuPsjm7m863dLnPUFOptsFVANDOHgDYopKBFYoIMoxjXU7bOzLL-Ez0oO5keT1hGZkJT_7GRvKyYigugN4lLia4Tb3AmUN60wiloyQCJ2xYATWHB0e4sTwIDq6MFXhVFHXV6ZBU7sDh0HqmP08gJtMnsFOE7zUcbpqTvpz5nAR6EyUs7R0g61WmGUfQTrE6byVCZ8w0NN4Xer6IQBjnDZWbmf69jsAFFAYDCe-omWXY526qLQw',
      use: 'sig',
    },
    {
      kid: 'KEY_2',
      e: 'AQAB',
      kty: 'RSA',
      n:
        '7KRDtHuJ9-R1cYzB9-E4TUVazzv93MMmMo_38nOwEKNxlWs7OVg397d0SCsdmBbcbr4KTMeblY4a-VOzLVZ5ycYgi7ZbMvv7RzunKuPsjm7m863dLnPUFOptsFVANDOHgDYopKBFYoIMoxjXU7bOzLL-Ez0oO5keT1hGZkJT_7GRvKyYigugN4lLia4Tb3AmUN60wiloyQCJ2xYATWHB0e4sTwIDq6MFXhVFHXV6ZBU7sDh0HqmP08gJtMnsFOE7zUcbpqTvpz5nAR6EyUs7R0g61WmGUfQTrE6byVCZ8w0NN4Xer6IQBjnDZWbmf69jsAFFAYDCe-omWXY526qLQw',
      use: 'sig'
    }
  ],
}
const privateKey = readFileSync(path.join(__dirname, 'private.pem'), 'utf8')
const jwk = jwks.keys[1]
const token = jwt.sign({ name: 'Jane Doe' }, privateKey, {
  algorithm: jwk.alg,
  issuer: domain,
  keyid: jwk.kid,
})
const oidcConfig = {
  issuer: 'https://localhost/',
  jwks_uri: 'https://localhost/.well-known/certs',
}

module.exports = {
  oidcConfig,
  domain,
  token,
  jwks,
}
