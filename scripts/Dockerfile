ARG NODE_VERSION=8.9.4
FROM node:${NODE_VERSION} as builder

ADD app /app
ADD package.json /package.json
ADD package-lock.json /package-lock.json

# Set up dependencies
RUN npm install --production

# Create output image
# ------------------------------------------------------------------------------

FROM node:${NODE_VERSION}

COPY --from=builder /app /app
COPY --from=builder /package.json /package.json
COPY --from=builder /node_modules /node_modules

EXPOSE 80

CMD ["npm", "start", "80"]
