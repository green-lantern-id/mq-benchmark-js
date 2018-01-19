class PoissonObject {
  
  constructor(lambda) {
    var cdf = [Math.pow(Math.E,-1*lambda)];

    this.getPMF = function(k) {
      let result = 1;
      let tmpLambda = lambda;
      for(let i = 1 ; i <= k ; i++) {
        result *= lambda/i
        if(tmpLambda >=1 ) {
          tmpLambda--;
          result /= Math.E;
        }
      }
      result /= Math.pow(Math.E,tmpLambda);
      return result;
    }

    this.getCDF = function(k) {
      let start = cdf.length - 1;
      if(start < k) {
        for(let i = start + 1 ; i <= k ; i++)
          cdf.push(cdf[i-1] + this.getPMF(i));
      }
      return cdf[k];
    }

    this.sample = function() {
      let target = Math.random();
      for(let i = 0 ; true ; i++) {
        if(target <= this.getCDF(i)) return i;
      }
    }

    this.getLambda = () => lambda;

    this.getCDF(2*lambda); //pre compute

  }

}

/*var poi = new PoissonObject(100);
console.log('Initiated');
for(let i = 0 ; i < 100 ; i++) {
  console.log(poi.sample());
}*/

module.exports = PoissonObject;
