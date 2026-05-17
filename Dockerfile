# Chạy cả 3 dịch vụ (InfluxDB, Telegraf, Grafana) trong 1 container để test trên Render
FROM ubuntu:22.04

# Bỏ qua các prompt hỏi cấu hình
ENV DEBIAN_FRONTEND=noninteractive

# Cài đặt các thư viện cần thiết
RUN apt-get update && apt-get install -y wget gnupg2 software-properties-common supervisor curl apt-transport-https

# 1. Cấu hình Repository cho InfluxDB & Telegraf (Sử dụng GPG Key chuẩn mới nhất)
RUN wget -q https://repos.influxdata.com/influxdata-archive.key && \
    cat influxdata-archive.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive.gpg > /dev/null && \
    echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive.gpg] https://repos.influxdata.com/debian stable main' | tee /etc/apt/sources.list.d/influxdata.list

# 2. Cấu hình Repository cho Grafana
RUN wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/grafana.gpg > /dev/null && \
    echo "deb [signed-by=/etc/apt/trusted.gpg.d/grafana.gpg] https://apt.grafana.com stable main" | tee /etc/apt/sources.list.d/grafana.list

# 3. Cập nhật apt và Cài đặt đồng loạt 3 phần mềm
RUN apt-get update && apt-get install -y influxdb2 telegraf grafana

# Copy file telegraf.conf của bạn vào container
# Trên Github, file telegraf.conf của bạn đang nằm ở thư mục gốc (ngang hàng với README)
COPY telegraf.conf /etc/telegraf/telegraf.conf

# Cấu hình Supervisor để chạy song song 3 tiến trình
RUN echo '[supervisord]\n\
nodaemon=true\n\
\n\
[program:influxdb]\n\
command=influxd\n\
stdout_logfile=/var/log/influxdb.log\n\
stderr_logfile=/var/log/influxdb_err.log\n\
\n\
[program:telegraf]\n\
command=telegraf --config /etc/telegraf/telegraf.conf\n\
stdout_logfile=/var/log/telegraf.log\n\
stderr_logfile=/var/log/telegraf_err.log\n\
\n\
[program:grafana]\n\
command=/usr/sbin/grafana-server --homepath=/usr/share/grafana --config=/etc/grafana/grafana.ini\n\
stdout_logfile=/var/log/grafana.log\n\
stderr_logfile=/var/log/grafana_err.log\n' > /etc/supervisor/conf.d/supervisord.conf

# Render yêu cầu dùng cổng do họ chỉ định, ta chỉnh Grafana chạy trên cổng đó (Render gán vào biến môi trường PORT)
# Cổng mặc định của InfluxDB vẫn là 8086 ở localhost bên trong container
ENV GF_SERVER_HTTP_PORT=10000
EXPOSE 10000

# Khởi chạy tất cả qua supervisor
CMD ["/usr/bin/supervisord"]
