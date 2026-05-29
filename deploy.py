"""
deploy.py — Deploy VeriaApp to Hostinger
Usage:  python deploy.py
"""
import sys, subprocess, time
sys.stdout.reconfigure(encoding='utf-8')
import paramiko

HOST    = '82.198.229.155'
PORT    = 65002
USER    = 'u775839017'
KEYFILE = r'C:\Users\bdali\.ssh\hostinger_pa'

# Detect the nodejs path for veria.dalivand.com
NODE_PATH = f'/home/{USER}/domains/veriaapp.persianatheists.com/nodejs'

def connect():
    key = paramiko.Ed25519Key.from_private_key_file(KEYFILE)
    t = paramiko.Transport((HOST, PORT))
    t.connect(username=USER, pkey=key)
    return paramiko.SFTPClient.from_transport(t), t

def ssh_exec(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def run():
    print('Connecting to server...')
    key = paramiko.Ed25519Key.from_private_key_file(KEYFILE)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, pkey=key)
    print('Connected.')

    print('\n[1/4] git pull...')
    out, err = ssh_exec(client, f'cd {NODE_PATH} && git pull origin main 2>&1')
    print(out or err)

    print('\n[2/4] npm install...')
    out, err = ssh_exec(client, f'cd {NODE_PATH} && /opt/alt/alt-nodejs20/root/usr/bin/npm install --production 2>&1 | tail -5')
    print(out or err)

    print('\n[3/4] Restarting Passenger...')
    out, err = ssh_exec(client, "kill $(pgrep -f lsnode) 2>/dev/null; sleep 1; echo done")
    print(out or err)

    print('\n[4/4] Warming up server...')
    time.sleep(3)
    out, err = ssh_exec(client, f'curl -s -o /dev/null -w "%{{http_code}}" https://veriaapp.persianatheists.com/')
    print(f'HTTP status: {out}')

    client.close()
    print('\nDeploy complete!')

if __name__ == '__main__':
    run()
