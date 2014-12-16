<br />
Our research lab recently conducted an experiment in which we attempted to manipulate innovative thinking through a series of psychological prompts. Subjects were given descriptions of various objects, and were either told that they had been commercial successes or failures (or neither, in which case they were simply described in detail). Then they were asked to write down other possible uses for these objects. An independent panel rated subjects' written responses for innovativeness and uniqueness, and support was found for our research hypothesis: preconceived notions of failure will limit one's ability to think creatively about other possible applications of a product.
<br /><br />
Here, we used text analysis and linear modeling to try and identify which prompt subjects were given, based solely on an algorithmic analysis of the patterns of language which appeared in their writing. Documents were vectorized into bags-of-words, then each term was treated as a feature in a linear regression (LASSO-regularized). We compared model predictive accuracy against a permuted null distribution, and found that our model identified experimental condition membership significantly above chance, providing support for the human rater's evaluations.
<br /><br />
Informal writeup of findings: <a href="http://github.com/andrew-reece/datascience/blob/master/innovation-mining/innovation-mining.pdf">Source code</a> 
<br />
NB: This writeup also includes a section on linguistic social network analysis, not included in the source code file below.
<br /><br />
<a href="http://github.com/andrew-reece/datascience/blob/master/innovation-mining/innovation.R">Source code</a> 
<br />
Coding language: R