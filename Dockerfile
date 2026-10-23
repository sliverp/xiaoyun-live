FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/xiaoyun/runtime
RUN npm init -y && npm install --save-exact @deepseek-ai/dsh@0.1.2-alpha.4 yaml@2.8.1
COPY plugin /opt/xiaoyun/plugin
RUN cd /opt/xiaoyun/plugin && npm ci --omit=dev --ignore-scripts && ln -s /opt/xiaoyun/runtime/node_modules /opt/xiaoyun/node_modules
COPY deploy /opt/xiaoyun/deploy
ENV DSH_HOME=/data HOME=/data/home PATH=/opt/xiaoyun/runtime/node_modules/.bin:$PATH
WORKDIR /opt/xiaoyun
ENTRYPOINT ["bash", "/opt/xiaoyun/deploy/entrypoint.sh"]
