import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// CJS interop guard for swagger-jsdoc
const jsdocFn = typeof swaggerJsdoc === 'function' ? swaggerJsdoc : swaggerJsdoc.default;

// CJS interop guard for swagger-ui-express
const serve = swaggerUi.serve || swaggerUi.default?.serve;
const setup = swaggerUi.setup || swaggerUi.default?.setup;

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Service Schedule API',
      version: '1.0.0',
      description: 'AI-driven scheduling API for OrchestratorAI agents',
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      responses: {
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'VALIDATION_ERROR' },
                      message: { type: 'string', example: 'Invalid request parameters' },
                    },
                    required: ['code', 'message'],
                  },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'NOT_FOUND' },
                      message: { type: 'string', example: 'Resource not found' },
                    },
                    required: ['code', 'message'],
                  },
                },
              },
            },
          },
        },
        Conflict: {
          description: 'Resource conflict',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string', example: 'CONFLICT' },
                      message: { type: 'string', example: 'Resource already exists' },
                    },
                    required: ['code', 'message'],
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ['./src/routes/**/*.js', './src/routes/*.js'],
};

const swaggerSpec = jsdocFn(options);

export { swaggerSpec, serve, setup };
export default swaggerUi;
