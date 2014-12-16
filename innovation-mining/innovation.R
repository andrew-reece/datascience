##########################################################################################
#
#   Innovation Mining: Using text analysis to identify patterns of innovative thinking
#
#   Authors:  Andrew Reece <reece@g.harvard.edu>
#             Colin Bosma  <bosma.colin@gmail.com>
#
#   Date:     May 2014
#
#   Background: A psychological study was conducted where subjects were randomly assigned
#               to different prompts meant to stimulate varying levels of innovative thinking.
#               Then subjects were asked to write down their thoughts on the potential uses
#               of various objects. The working hypothesis was that subjects who were given
#               'high-innovation' prompts would generate more innovative uses for the objects,
#               as rated by independent judges. 
#               This project is an attempt to make the same evaluation, but algorithmically, 
#               using text-analysis algorithms and linear modeling. 
#
##########################################################################################


# load packages
require(boot)
require(glmnet)
require(Matrix)
require(SnowballC)
require(tm)

# load data
df <- read.csv("http://people.fas.harvard.edu/~reece/3490/innovation.csv", stringsAsFactors=F)

# simple formatting
colnames(df)[4] <- "text"
df <- df[,c(1,2,4)] # drop LMS column
names(df)
# create corpus from dataset
m <- list(ID = "ID", Condition="Condition", Content = "text")
reader <- readTabular(mapping = m)
df.corp <- Corpus(DataframeSource(df))
df2 <- Corpus(DataframeSource(df))
inspect(df2[1])
# set up formatting functions
skipWords <- function(x) removeWords(x, stopwords("english"))
funcs.noskip <- list(tolower, removePunctuation, removeNumbers, stripWhitespace)
funcs <- list(content_transformer(tolower), removePunctuation, removeNumbers, stripWhitespace, skipWords)
View(df)
# clean up main corpus
df.corp.skip <- tm_map(df.corp, FUN = tm_reduce, tmFuns = funcs)

inspect(df.corp.skip[1:10])

# make dtm
dtm <- DocumentTermMatrix(df.corp.skip, control = list(wordLengths = c(3,Inf),weighting=weightTfIdf)) 
# convert to matrix
mat <- as.matrix(dtm)
View(mat)
# add conditions vector as 3-factor dv
mat <- cbind(mat,as.factor(df$Condition))
colnames(mat)[ncol(mat)] <- "dv" 

# convert to sparse matrix
sm <- Matrix(data=mat, dimnames=list(NULL,colnames(mat)), sparse = TRUE)

# useful readable shortcuts for later
iv.ct <- (ncol(sm)-1)
dv.idx  <- ncol(sm)
row.ct <- nrow(sm)

# with over 2500 predictors, we need to reduce our feature space
# we can use lasso regularization for that with glmnet package

# there seems to be a lot of variance in prediction accuracy rates
# so we run 10-fold cv to fit the model, and then take avg accuracy over 100 fittings 

# WARNING: this loop takes awhile to run, maybe 10-15 min.  
# cv.glmnet has a parallel=T parameter that uses the forEach package to 
# parallelize cross-validation, and that may speed things up if you're in a hurry.

# first initialize storage vectors 
lasso.acc <- c()
lasso.class.acc <- c()

# now average across 100 cv'd models

max.iter <- 10 # we changed it to 3 for the final submission in the interest of speed - but we originally ran with 100
for (i in 1:max.iter) {
  
  # take roughly 75% of data as training data (90/121)
  train <- sample(1:row.ct, floor(0.75*row.ct), replace=FALSE)
  x <- sm[train, 1:iv.ct]
  y <- sm[train, dv.idx] # dv = assigned condition (1, 2,or 3)]
  
  # cv.glmnet has 10-fold cv as default
  # alpha=1 is also default (ie. uses lasso instead of ridge or elastic net regularization)
  cv.lasso <- cv.glmnet(x,y, family="multinomial")
  
  # default loss function for multinomial is deviance
  # we can also use classification error rate
  cv.lasso.class <- cv.glmnet(x,y, family="multinomial", type.measure="class")
  
  # use -train from sm as test data
  pred.lasso <- predict(cv.lasso, newx = sm[-train, 1:iv.ct], s = "lambda.min", type = "class")
  pred.lasso.class <- predict(cv.lasso.class, newx = sm[-train, 1:iv.ct], s = "lambda.min", type = "class")
  
  # generate confusion tables - useful if you're not looping
  # pred.table.lasso <- table(sm[-train,2566], pred.lasso)
  # pred.table.lasso.class <- table(sm[-train,2566], pred.lasso.class)
  
  # accuracy measure: true positives over total possible
  acc <- sum(sm[-train, dv.idx] == pred.lasso)/length(pred.lasso)
  acc.class <- sum(sm[-train, dv.idx] == pred.lasso.class)/length(pred.lasso.class)
  
  # store accuracy in vectors for averaging later
  lasso.acc[i] <- acc
  lasso.class.acc[i] <- acc.class
}

# glmnet extra: we can plot to see optimal lambda minimization
plot(cv.lasso) # this is only for one instance of the model fit, just as example.
plot(cv.lasso.class) # this is only for one instance of the model fit, just as example.

# get mean accuracy rates from 100 fittings - both yield about 52% accuracy
avg.lasso.acc <- mean(lasso.acc)              
avg.lasso.class.acc <- mean(lasso.class.acc)  

# chance accuracy is 33%, as there are 3 possible outcomes 
# (ie. document author was assigned to Condition 1, 2, or 3)
# so at ~52% accuracy, it looks like the model is doing pretty well...
# but we can generate a null distribution with permutation to be sure.
# we can use the prediction vector from the final iteration of the model for-loop.
perm.acc <- function(x,d){
  actual <- x[,1]
  predicted <- x[,2]
  new.actual <- actual[d] # store the permuted actual conditions in a new vector
  acc <- sum(new.actual==predicted)/length(new.actual) 
  return(acc)
}

# run permutation with perm.acc function
perm.results <- boot(data.frame(sm[-train,dv.idx],pred.lasso), 
                     perm.acc, R=5000, sim="permutation")

# we can compute a 0.05 alpha cutoff for NHST via z-score...
perm.mean <- mean(perm.results$t)
perm.sd <- sd(perm.results$t)
sig.cutoff <- perm.mean + 1.96*perm.sd
avg.lasso.acc >= sig.cutoff # true

# or we can use pnorm()
lasso.p <- 1 - pnorm(avg.lasso.acc, perm.mean, perm.sd) 
lasso.p <= 0.05 # true

# plot permutation distribution, along with:
#     alpha cutoff (navy)
#     avg accuracy (green)
#     actual accuracy for the prediction vector used (darkorchid)*

# * what we mean here is that the permutation itself is based on the 
#   prediction vector from the final lasso model fit in the for loop.
#   even though the averaged lasso accuracy is better, we include the
#   actual accuracy average for this prediction vector as well, for reference.

# make histogram of permutation
hist(perm.results$t,
     xlim=c(0,.8),
     main="Permuted distribution of LASSO model prediction accuracy",
     ylab="Frequency",
     xlab="% Accuracy")
# add vertical lines for cutoff and accuracies
abline(v=c( sig.cutoff, avg.lasso.acc, perm.results$t0 ), 
       col=c("navy","green","darkorchid"), lty=c(1,2,2), lwd=3)
# make legend
x.offset <- .001 
y.offset <- 1350
legend(x.offset, y.offset, c("sig.cutoff","lasso avg","samp.vec"), cex=0.8, 
       col=c("navy","green","darkorchid"), lty=c(1,2,2), lwd=3)
