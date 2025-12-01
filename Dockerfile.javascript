FROM node:22-alpine
WORKDIR /usr/src/app

# Build argument
ARG ALGORITHM

COPY sample_algorithms/Sorting/javascript/${ALGORITHM} ./algorithm.js
COPY tracers/ ./tracers/

CMD [ "node", "algorithm.js" ]
