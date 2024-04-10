import { Sequelize } from 'sequelize';

const sequelize = new Sequelize('lokkerroom', 'hazarkocturk', 'hazar', {
    dialect: 'postgres',
    host: 'localhost',
    port: 5434,
    logging: console.log,
    quoteIdentifiers: false
});

export default sequelize;