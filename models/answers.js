'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class answers extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  answers.init({
    answer: DataTypes.STRING,
    question_id: DataTypes.INTEGER,
    is_correct: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'answers',
  });
  return answers;
};