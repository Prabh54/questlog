FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
COPY frontend/package.json ./frontend/
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --workspace=frontend --workspace=shared
COPY frontend ./frontend
COPY shared ./shared
RUN npm run build --workspace=shared
RUN npm run build --workspace=frontend

FROM nginx:alpine AS runner
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
