import { expect } from 'tstyche'
import Cache from '../../src/cache'
import buildGetJwks, { GetJwksOptions, GetPublicKeyOptions, JWK, JWKSignature } from '../../src/get-jwks'
import * as undici from "undici-types";

const { getPublicKey, getJwk, getJwksUri, cache, staleCache } = buildGetJwks()

expect(getJwk).type.toBeAssignableTo<(signature: JWKSignature) => Promise<JWK>>()
expect(getJwksUri).type.toBeAssignableTo<(normalizedDomain: string) => Promise<string>>()
expect(getPublicKey).type.toBeAssignableTo<(options?: GetPublicKeyOptions) => Promise<string>>()
expect(cache).type.toBeAssignableTo<Cache<string, JWK>>()
expect(staleCache).type.toBeAssignableTo<Cache<string, JWK>>()
expect({ dispatcher: undici.getGlobalDispatcher() }).type.toBeAssignableTo<GetJwksOptions['fetchOptions']>()
