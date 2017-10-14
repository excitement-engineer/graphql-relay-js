/**
 *  Copyright (c) 2015, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  GraphQLInt,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLNonNull,
  graphql,
} from 'graphql';

import {
  connectionFromArray,
} from '../arrayconnection.js';

import {
  backwardConnectionArgs,
  connectionArgs,
  connectionDefinitions,
  forwardConnectionArgs,
} from '../connection.js';

import { expect } from 'chai';
import { describe, it } from 'mocha';

const allUsers = [
  { name: 'Dan', friends: [ 1, 2, 3, 4 ] },
  { name: 'Nick', friends: [ 0, 2, 3, 4 ] },
  { name: 'Lee', friends: [ 0, 1, 3, 4 ] },
  { name: 'Joe', friends: [ 0, 1, 2, 4 ] },
  { name: 'Tim', friends: [ 0, 1, 2, 3 ] },
];

const userType = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    name: {
      type: GraphQLString,
    },
    friends: {
      type: friendConnection,
      args: connectionArgs,
      resolve: (user, args) => connectionFromArray(user.friends, args),
    },
    friendsForward: {
      type: userConnection,
      args: forwardConnectionArgs,
      resolve: (user, args) => connectionFromArray(user.friends, args),
    },
    friendsBackward: {
      type: userConnection,
      args: backwardConnectionArgs,
      resolve: (user, args) => connectionFromArray(user.friends, args),
    },
  }),
});

const {connectionType: friendConnection} = connectionDefinitions({
  name: 'Friend',
  nodeType: userType,
  resolveNode: edge => allUsers[edge.node],
  edgeFields: () => ({
    friendshipTime: {
      type: GraphQLString,
      resolve: () => 'Yesterday'
    }
  }),
  connectionFields: () => ({
    totalCount: {
      type: GraphQLInt,
      resolve: () => allUsers.length - 1
    }
  }),
});

const {connectionType: userConnection} = connectionDefinitions({
  nodeType: new GraphQLNonNull(userType),
  resolveNode: edge => allUsers[edge.node],
});

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    user: {
      type: userType,
      resolve: () => allUsers[0],
    },
  })
});

const schema = new GraphQLSchema({
  query: queryType,
});

describe('connectionDefinition()', () => {
  it('includes connection and edge fields', async () => {
    const query = `
      query FriendsQuery {
        user {
          friends(first: 2) {
            totalCount
            edges {
              friendshipTime
              node {
                name
              }
            }
          }
        }
      }
    `;
    const expected = {
      user: {
        friends: {
          totalCount: 4,
          edges: [
            {
              friendshipTime: 'Yesterday',
              node: {
                name: 'Nick'
              }
            },
            {
              friendshipTime: 'Yesterday',
              node: {
                name: 'Lee'
              }
            },
          ]
        }
      }
    };
    const result = await graphql(schema, query);
    expect(result).to.deep.equal({ data: expected });
  });

  it('works with forwardConnectionArgs', async () => {
    const query = `
      query FriendsQuery {
        user {
          friendsForward(first: 2) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const expected = {
      user: {
        friendsForward: {
          edges: [
            {
              node: {
                name: 'Nick'
              }
            },
            {
              node: {
                name: 'Lee'
              }
            },
          ]
        }
      }
    };
    const result = await graphql(schema, query);
    expect(result).to.deep.equal({ data: expected });
  });

  it('works with backwardConnectionArgs', async () => {
    const query = `
      query FriendsQuery {
        user {
          friendsBackward(last: 2) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    `;
    const expected = {
      user: {
        friendsBackward: {
          edges: [
            {
              node: {
                name: 'Joe'
              }
            },
            {
              node: {
                name: 'Tim'
              }
            },
          ]
        }
      }
    };
    const result = await graphql(schema, query);
    expect(result).to.deep.equal({ data: expected });
  });

  describe('introspection', () => {
    it('has the correct connection structure', async () => {
      const query = `
      {
       userConnection: __type(name: "UserConnection") {
         fields {
           name
           type {
             name
             kind
             ofType {
               name
               kind
             }
           }
        
         }
       }
   }`;

      const expected = {
        userConnection: {
          fields: [ {
            name: 'pageInfo',
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: 'PageInfo'
              }
            }
          }, {
            name: 'edges',
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: 'UserEdge'
              }
            }
          } ]
        }
      };
      const result = await graphql(schema, query);
      expect(result).to.deep.equal({ data: expected });
    });

    it('has the correct edge structure', async () => {
      const query = `{
        __type(name: "UserEdge") {
          fields {
            name
            type {
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }`;

      const expected = {
        __type: {
          fields: [
            {
              name: 'node',
              type: {
                kind: 'NON_NULL',
                ofType: {
                  kind: 'OBJECT',
                  name: 'User'
                }
              }
            },
            {
              name: 'cursor',
              type: {
                kind: 'NON_NULL',
                ofType: {
                  kind: 'SCALAR',
                  name: 'String'
                }
              }
            }
          ]
        }
      };
      const result = await graphql(schema, query);
      expect(result).to.deep.equal({ data: expected });
    });
  });

});
