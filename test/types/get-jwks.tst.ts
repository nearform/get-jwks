import { expect } from 'tstyche'
import Cache from '../../src/cache'
import buildGetJwks, { GetJwksOptions, GetPublicKeyOptions, JWK, JWKSignature } from '../../src/get-jwks'
import * as undici from "undici-types";

const { getPublicKey, getJwk, getJwksUri, cache, staleCache } = buildGetJwks()

expect(getJwk).type.toBe<(signature: JWKSignature) => Promise<JWK>>()
expect(getJwksUri).type.toBe<(normalizedDomain: string) => Promise<string>>()
expect(getPublicKey).type.toBe<(options?: GetPublicKeyOptions) => Promise<string>>()
expect(cache).type.toBe<Cache<string, JWK>>()
expect(staleCache).type.toBe<Cache<string, JWK>>()
expect({ dispatcher: undici.getGlobalDispatcher() }).type.toBeAssignableTo<GetJwksOptions['fetchOptions']>()
