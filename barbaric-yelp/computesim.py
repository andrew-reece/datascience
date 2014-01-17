from mrjob.job import MRJob
from itertools import combinations, permutations
from operator import itemgetter
from scipy.stats.stats import pearsonr
from numpy import isnan

class RestaurantSimilarities(MRJob):

	def steps(self):
		"the steps in the map-reduce process"
		thesteps = [
			self.mr(mapper=self.line_mapper, reducer=self.users_items_collector),
			self.mr(mapper=self.pair_items_mapper, reducer=self.calc_sim_collector)
		]
		return thesteps
        
	def line_mapper(self,_,line):
    
		user_id,business_id,stars,business_avg,user_avg=line.split(',')
		yield user_id, (business_id,stars,business_avg,user_avg)

	def users_items_collector(self, user_id, values):

		# feed values generator into a list comprehension
		values = [val for val in values]
		# yield new values list along with user_id
		yield user_id, values

	def pair_items_mapper(self, user_id, values):
	
		# initialize keys list
		keys = []
		# feed in vals from generator
		vals = [v for v in values]
		# sort vals list
		vals = sorted(vals, key=itemgetter(0))
		
		# pull out keys
		# NB: we don't really need this step, but it makes for more readable code
		for v in vals:
			keys.append(v[0])
		
		# loop through combination pairs, return keys and values
		# NB: I'm actually not sure what's more readable here - we could just do combinations() on vals itself,
		#     and then chop it up by sub-indexing in the yield statement.  I discussed this with Brian Feeny (who helped a lot
		#     on this assignment!) and I ended up implementing in the way he described, mostly for readability's sake.
		for k, v in zip(combinations(keys,2), combinations(vals,2)):
			yield k, v


	def calc_sim_collector(self, key, values):
	
		(rest1, rest2), common_ratings = key, values
		# this is our n_common counter
		n_common = 0
		# lists to catch ratings difference scores for both restaurants
		r1 = []
		r2 = []
		
		# loop through values, pull out ratings, compute differences, append to lists
		for valset in values:
		
			n_common += 1
		
			rest1_stars = float(valset[0][1])
			rest1_user_avg = float(valset[0][3])
			rest2_stars = float(valset[1][1])
			rest2_user_avg = float(valset[1][3])

			diff1=rest1_stars-rest1_user_avg
			diff2=rest2_stars-rest2_user_avg

			r1.append(diff1)
			r2.append(diff2)
        
        # compute pearson's
		rho = pearsonr(r1, r2)[0]
		# check for NaN, if so return 0
		rho = rho if (not isnan(rho)) else 0

		# yield rest_id tuple as key, rho/ncom tuple as val
		yield (rest1, rest2), (rho, n_common)
		
#Below MUST be there for things to work
if __name__ == '__main__':
	RestaurantSimilarities.run()
