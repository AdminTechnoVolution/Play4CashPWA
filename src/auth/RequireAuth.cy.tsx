import React from 'react'
import { RequireAuth } from './RequireAuth'

describe('<RequireAuth />', () => {
  it('renders', () => {
    // see: https://on.cypress.io/mounting-react
    cy.mount(<RequireAuth />)
  })
})