import supertest from 'supertest'

import { PluginServer } from '../src/server'
import { PluginServerMode } from '../src/types'

describe('router', () => {
    let server: PluginServer

    beforeAll(async () => {
        jest.spyOn(process, 'exit').mockImplementation()

        server = new PluginServer({
            PLUGIN_SERVER_MODE: PluginServerMode.ingestion_v2,
        })
        await server.start()
    })

    afterAll(async () => {
        await server.stop()
    })

    // these should simply pass under normal conditions
    describe('health and readiness checks', () => {
        it('responds to _health', async () => {
            const res = await supertest(server.expressApp).get(`/_health`).send()

            expect(res.status).toEqual(200)
            expect(res.body).toMatchInlineSnapshot(`
                {
                  "checks": {
                    "ingestion-consumer-events_plugin_ingestion_test": "ok",
                  },
                  "status": "ok",
                }
            `)
        })

        test('responds to _ready', async () => {
            const res = await supertest(server.expressApp).get(`/_ready`).send()

            expect(res.status).toEqual(200)
            expect(res.body).toMatchInlineSnapshot(`
                {
                  "checks": {
                    "ingestion-consumer-events_plugin_ingestion_test": "ok",
                  },
                  "status": "ok",
                }
            `)
        })
    })
})
