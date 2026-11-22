import { networkInterfaces } from 'node:os';

export const lanPort=Number(process.env.LASER_LAN_PORT || 5188);
export const isPrivateIPv4=ip=>/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip);

export function lanAddress() {
  const adapters=Object.entries(networkInterfaces())
    .flatMap(([name,addresses])=>(addresses || []).map(address=>({name,...address})))
    .filter(address=>address.family==='IPv4' && !address.internal && isPrivateIPv4(address.address));
  const priority = ({name}) => /wi.?fi|wireless|wlan/i.test(name) ? 0
    : /virtual|hyper-v|vpn|vethernet|loopback/i.test(name) ? 2 : 1;
  return adapters.sort((a,b)=>priority(a)-priority(b))[0]?.address;
}
