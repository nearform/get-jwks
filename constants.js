module.exports = {
  jwks: {
    keys: [
      {
        alg: 'RS512',
        kid: 'KEY_0',
        e: 'AQAB',
        kty: 'RSA',
        n: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImp0aSI6ImZmMTBmMTg1LWFiODEtNDhjYS1hZmI1LTdkY2FhMzNmYzgzNSIsImlhdCI6MTYxNDEwMzkxNiwiZXhwIjoxNjE0MTA3NTE2fQ.mLx1TZaHDhcymZFmLM7pfBhowY7CEgjuxr54LPXpGXc',
        use: 'sig'
      },
      {
        alg: 'HS256',
        kid: 'KEY_1',
        e: 'AQAB',
        kty: 'RSA',
        n: "123",
        use: 'sig'
      }
    ]
  }
}
