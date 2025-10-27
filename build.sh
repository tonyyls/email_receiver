#!/usr/bin/env bash

# 构建 x86_64 Docker 镜像
docker build --platform linux/x86_64 -t email-receiver-api:latest .


