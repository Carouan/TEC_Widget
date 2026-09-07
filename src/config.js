export const preparedProfiles = {
  outbound: {
    id: 'outbound',
    stopName: 'Belgrade - Rue Laide Coupe',
    route: '9',
    direction: 'Jambes',
    demoDepartures: ['07:48', '08:03', '08:18']
  },
  inbound: {
    id: 'inbound',
    stopName: 'Rue des Combattants',
    route: '9',
    direction: 'Flawinne',
    demoDepartures: ['16:41', '16:56', '17:11']
  }
};

export const defaultFavorites = [
  {
    id: 'home-work',
    name: 'Maison → Travail',
    profileId: 'outbound',
    days: [1, 2, 3, 4, 5],
    period: 'morning',
    startTime: '07:00'
  },
  {
    id: 'work-home',
    name: 'Travail → Maison',
    profileId: 'inbound',
    days: [1, 2, 3, 4, 5],
    period: 'afternoon',
    startTime: '16:00'
  }
];
