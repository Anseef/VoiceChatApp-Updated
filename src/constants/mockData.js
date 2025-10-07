// src/constants/mockData.js

export const CONTACTS = [
  { id: '1', name: 'Angel', lastMessage: 'Please help me find a good monitor for t...', time: '09:10', unread: 2, image: require('../../assets/profileDemo.jpg') },
  { id: '2', name: 'Rahul', lastMessage: 'I am doing great, thanks for asking!', time: '02:56', unread: 0, image: require('../../assets/profileDemo1.jpg') },
  { id: '3', name: 'Sam', lastMessage: 'No one can come today?', time: '02:55', unread: 2, image: require('../../assets/profileDemo2.png') },
  { id: '4', name: 'Amal', lastMessage: "Sure, I'll let you know!", time: '03:51', unread: 1, image: require('../../assets/profileDemo3.png') },
  { id: '5', name: 'Rohit', lastMessage: 'Hey Yato, How are you!', time: '07:11', unread: 0, image: require('../../assets/profileDemo4.png') },
];

export const initialConversations = {
  'Angel': [
    {id: 'ac1', text: 'Hey, I saw the new project docs.', sender: 'Angel', read: false},
    {id: 'ac2', text: 'Please help me find a good monitor for the design team.', sender: 'Angel', read: false}
  ],
  'Rahul': [{id: 'zd1', text: 'I am doing great, thanks for asking!', sender: 'Rahul', read: false}],
  'Sam': [
      {id: 'km1', text: 'Did everyone submit their report?', sender: 'Sam', read: false},
      {id: 'km2', text: 'No one can come today?', sender: 'Sam', read: false}
  ],
  'Amal': [{id: 'am1', text: "Sure, I'll let you know!", sender: 'Amal', read: false}],
  'Rohit': [{id: 'am1', text: "Hey Yato, How are you!", sender: 'Rohit', read: true}],
};

