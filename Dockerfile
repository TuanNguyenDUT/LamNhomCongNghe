FROM node:20-alpine

WORKDIR /app

# 1. Cài đặt các thư viện cần thiết
COPY package*.json ./
RUN npm install --omit=dev

# 2. Sao chép mã nguồn backend
COPY src/ ./src/

# 3. Sao chép bản build web Flutter đã đóng gói (phục vụ giao diện người dùng trực tiếp)
COPY mobile/build/web/ ./mobile/build/web/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "--no-warnings", "src/server.js"]
