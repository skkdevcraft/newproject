```bash
# Allow firewall access to port 1234
# LM Studio bound to 0.0.0.0:1234 (verified with ss -tlnp)
# UFW rule allowing Docker bridge → host:1234
sudo ufw allow from 172.17.0.0/16 to any port 1234 proto tcp

cp .pi/agent/models.json ~/.pi/agent/models.json
```

```sh
docker exec -it -u node strange_fermi /bin/bash
```